import Link from "next/link";
import {getRestaurant} from "@/lib/restaurant";
export const metadata={title:"Our story"};
export default async function About({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const r=await getRestaurant(slug);
  return <main id="main" className="container section story-page"><div className="story-heading"><span className="eyebrow">The people. The place. The plate.</span><h1>The story behind<br/><em>{r.name}.</em></h1><p>{r.cuisine} · {r.city} · Connected by ZAYQORA</p></div><div className="story-grid"><img src={r.hero_image_url||"/food/hero.jpg"} alt={`The restaurant setting at ${r.name}`}/><div><span className="eyebrow">A little introduction</span><h2>{r.tagline||"A place at the table."}</h2><p>{r.description}</p><div className="story-detail"><span>THE SETTING</span><strong>{r.city}</strong></div><div className="story-detail"><span>THE FLAVOUR</span><strong>{r.cuisine}</strong></div><Link className="button" href={`/r/${slug}/menu`}>Meet the menu ↗</Link></div></div>{slug==="saffron-table"&&<p className="notice story-demo">Saffron Table is a demonstration restaurant, showcasing the ZAYQORA experience. Menu and restaurant details are demo data, not a real service offer.</p>}</main>;
}
