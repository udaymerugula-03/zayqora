import type {MetadataRoute} from "next";
import type {Page,Restaurant} from "@/lib/types";
import {publicOrigin} from "@/lib/restaurant";
import {isDemo,websiteSettings} from "@/lib/website";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const origin=publicOrigin();
  if(!origin)return [];
  const entries:MetadataRoute.Sitemap=[{url:origin},{url:`${origin}/pricing`},{url:`${origin}/terms`},{url:`${origin}/privacy`}];
  let page=1;let received=0;let total=0;
  do {
    const response=await fetch(`${process.env.API_ORIGIN||"http://127.0.0.1:8086"}/api/v1/public/restaurants?page=${page}&page_size=100`,{cache:"no-store"});
    if(!response.ok)throw new Error("Published restaurant sitemap is currently unavailable.");
    const result:Page<Restaurant>=await response.json();total=result.total;received+=result.items.length;
    for(const restaurant of result.items) {
      if(!restaurant.published||isDemo(restaurant))continue;
      const settings=websiteSettings(restaurant);
      const pages=["","/menu","/about","/contact","/policies",...(settings.reservations_enabled?["/reservations"]:[]),...(settings.gallery_enabled&&settings.gallery.length?["/gallery"]:[]),...(settings.faqs_enabled&&settings.faqs.length?["/faqs"]:[])];
      entries.push(...pages.map(path=>({url:`${origin}/r/${encodeURIComponent(restaurant.slug)}${path}`})));
    }
    if(!result.items.length)break;
    page++;
  }while(received<total);
  return entries;
}
