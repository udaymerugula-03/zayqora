import {notFound} from "next/navigation";
import type {Category, Restaurant} from "./types";
import type {Metadata} from "next";
import {isDemo, websiteSettings} from "./website";
export async function getRestaurant(slug:string):Promise<Restaurant>{
  const response=await fetch(`${process.env.API_ORIGIN||"http://127.0.0.1:8086"}/api/v1/public/restaurants/${encodeURIComponent(slug)}`,{cache:"no-store"});
  if(response.status===404)notFound();
  if(!response.ok)throw new Error("Restaurant service is currently unavailable. Please retry.");
  const restaurant:Restaurant=await response.json();
  if(isDemo(restaurant))notFound();
  return restaurant;
}
export async function getPublicMenu(slug:string):Promise<{categories:Category[]}> {
  const response=await fetch(`${process.env.API_ORIGIN||"http://127.0.0.1:8086"}/api/v1/public/restaurants/${encodeURIComponent(slug)}/menu`,{cache:"no-store"});
  if(!response.ok)throw new Error("The restaurant menu is currently unavailable. Please retry.");
  return response.json();
}
export function publicOrigin():string|undefined {
  const configured=process.env.PUBLIC_ORIGIN;
  if(!configured)return undefined;
  try {const url=new URL(configured);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password?url.origin:undefined;}
  catch {return undefined;}
}
export function restaurantMetadata(r:Restaurant,page:string,path=""):Metadata {
  const settings=websiteSettings(r);
  const origin=publicOrigin();
  return {
    title:`${page} · ${settings.seo_title||r.name}`,
    description:settings.seo_description||r.description||`${page} at ${r.name}`,
    robots:isDemo(r)?{index:false,follow:false}:undefined,
    alternates:origin?{canonical:`${origin}/r/${encodeURIComponent(r.slug)}${path}`}:undefined,
  };
}
