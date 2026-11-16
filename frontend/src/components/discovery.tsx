"use client";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import type {Page, Restaurant, Plan} from "@/lib/types";
import {Notice, Loading, Empty} from "./ui";
export function Discovery() {
  const q = useQuery({queryKey:["discovery"],queryFn:()=>api<Page<Restaurant>>("/public/restaurants")});
  if(q.isPending) return <Loading/>;
  if(q.isError) return <Notice error>{q.error.message} <button className="text-button" onClick={()=>q.refetch()}>Retry discovery</button></Notice>;
  return q.data.items.length ? <div className="restaurant-grid">{q.data.items.map(r=><Link className="restaurant-card" href={`/r/${r.slug}`} key={r.id}><div className="card-image"><img src={r.hero_image_url || "/food/hero.jpg"} alt={`${r.name} food`}/>{r.slug === "saffron-table" && <span className="image-label">Demonstration restaurant</span>}</div><div className="card-body"><div className="row between"><span className="eyebrow">{r.cuisine || "Restaurant"}</span><span className="arrow">↗</span></div><h3>{r.name}</h3><p>{r.tagline}</p><div className="card-meta"><span>⌖ {r.city}</span><span>{[r.allow_delivery && "Delivery",r.allow_pickup && "Pickup"].filter(Boolean).join(" · ")}</span></div></div></Link>)}</div> : <Empty>No restaurants are currently published. Please check back soon.</Empty>;
}
export function Plans({platform=false}: {platform?:boolean}) {
  const q=useQuery({queryKey:["public-plans"],queryFn:()=>api<{items:Plan[]}>("/public/plans")});
  if(q.isPending) return <Loading/>;
  if(q.isError) return <Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry</button></Notice>;
  return <div className="plan-grid">{q.data.items.length ? q.data.items.filter(p=>p.active).map(p=><article className="panel plan" key={p.id}><span className="eyebrow">Restaurant workspace</span><h2>{p.name}</h2><p>{p.description}</p><h3>{p.max_menu_items} menu items</h3><ul className="check-list"><li>Cash ordering &amp; public restaurant site</li><li>Menu, order &amp; reservation management</li><li>Sales reports &amp; owner workspace</li></ul><p className="muted">Plan entitlements only. No online billing or advertised subscription price.</p><Link className="button" href={platform?"/platform/plans":"/register"}>Create your restaurant ↗</Link></article>) : <Empty>No active plans are published.</Empty>}</div>;
}
