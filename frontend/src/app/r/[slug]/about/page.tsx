import Link from "next/link";
import {getRestaurant,restaurantMetadata} from "@/lib/restaurant";
import {isDemo,websiteSettings} from "@/lib/website";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;return restaurantMetadata(await getRestaurant(slug),"About","/about");
}
export default async function About({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=await getRestaurant(slug);const settings=websiteSettings(r);
  return <main id="main" className="container section story-page"><div className="story-heading"><span className="eyebrow">The people. The place. The plate.</span><h1>The story behind<br/><em>{r.name}.</em></h1><p>{[r.cuisine,r.city].filter(Boolean).join(" · ")} · Connected by ZAYQORA</p></div><div className="story-grid"><img src={r.hero_image_url||"/food/hero.jpg"} alt={r.hero_image_url?`${r.name} cover photograph`:"Illustrative restaurant photograph"}/><div><span className="eyebrow">A little introduction</span><h2>{r.tagline||`About ${r.name}`}</h2><p className="preserve-lines">{settings.about_text||r.description||"The restaurant has not added its story yet."}</p><div className="story-detail"><span>THE SETTING</span><strong>{r.city}</strong></div><div className="story-detail"><span>THE FLAVOUR</span><strong>{r.cuisine}</strong></div><Link className="button" href={`/r/${slug}/menu`}>Meet the menu ↗</Link></div></div>{isDemo(r)&&<p className="notice story-demo">This is a fictional demonstration restaurant. Menu and restaurant details are demo data, not a real service offer.</p>}</main>;
}
