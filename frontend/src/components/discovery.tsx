"use client";
import Link from "next/link";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import {money} from "@/lib/commerce";
import type {Page, Restaurant, Plan} from "@/lib/types";
import {Notice, Loading, Empty} from "./ui";
export function Discovery() {
  const [search,setSearch]=useState("");
  const [city,setCity]=useState("");
  const q = useQuery({queryKey:["discovery"],queryFn:()=>api<Page<Restaurant>>("/public/restaurants")});
  if(q.isPending) return <Loading/>;
  if(q.isError) return <Notice error>{q.error.message} <button className="text-button" onClick={()=>q.refetch()}>Retry discovery</button></Notice>;
  const restaurants=q.data.items.filter(r=>(!city||r.city===city)&&`${r.name} ${r.cuisine} ${r.city}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="discovery-tools"><label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Search restaurants or cuisine</span><input type="search" placeholder="A restaurant, a cuisine, a craving…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="city-filter"><span className="sr-only">Choose city</span><select value={city} onChange={e=>setCity(e.target.value)}><option value="">All cities</option>{[...new Set(q.data.items.map(r=>r.city))].filter(Boolean).map(c=><option key={c}>{c}</option>)}</select></label><span className="collection-count">{restaurants.length} place{restaurants.length===1?"":"s"} to discover</span></div>
    {restaurants.length?<div className="restaurant-grid">{restaurants.map((r,index)=><Link className="restaurant-card" href={`/r/${r.slug}`} key={r.id}>
      <div className="card-image"><img src={r.hero_image_url || "/food/hero.jpg"} alt={`A glimpse of ${r.name}`}/><span className="image-label">{r.slug==="saffron-table"?"Demonstration restaurant":r.cuisine||"Restaurant"}</span><span className="restaurant-number">0{index+1}</span></div>
      <div className="card-body"><div className="row between"><span className="eyebrow">{r.cuisine} · {r.city}</span><span className="arrow" aria-hidden="true">↗</span></div><h3>{r.name}</h3><p>{r.tagline||r.description}</p><div className="card-meta"><span>{[r.allow_delivery&&"Delivery",r.allow_pickup&&"Pickup"].filter(Boolean).join(" + ")||"View restaurant"}</span><span>Minimum {money(r.minimum_order)}</span></div></div>
    </Link>)}</div>:<Empty>{q.data.items.length?"No restaurants match this search. Try another city or craving.":"No restaurants are currently published. Please check back soon."}</Empty>}
  </>;
}
export function Plans({platform=false}: {platform?:boolean}) {
  const q=useQuery({queryKey:["public-plans"],queryFn:()=>api<{items:Plan[]}>("/public/plans")});
  if(q.isPending) return <Loading/>;
  if(q.isError) return <Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry</button></Notice>;
  return <div className="plan-grid">{q.data.items.filter(p=>p.active).length ? q.data.items.filter(p=>p.active).map((p,index)=><article className="panel plan" key={p.id}><div className="plan-topline"><span className="eyebrow">The restaurant collection</span><span>0{index+1}</span></div><h2>{p.name}</h2><p>{p.description}</p><div className="plan-entitlement"><strong>{p.max_menu_items}</strong><span>menu items<br/>in your collection</span></div><ul className="check-list"><li>Cash ordering &amp; public restaurant site</li><li>Menu, order &amp; reservation management</li><li>Sales reports &amp; owner workspace</li></ul><p className="fine">Plan entitlements only. No online billing or advertised subscription price.</p><Link className="button full" href={platform?"/platform/plans":"/register"}>Create your restaurant ↗</Link></article>) : <Empty>No active plans are published.</Empty>}</div>;
}
