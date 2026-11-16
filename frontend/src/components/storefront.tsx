"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {LocalLine,Restaurant} from "@/lib/types";
import {mutateCart} from "@/lib/commerce";
import {Header,Footer} from "./ui";
type CartContext={restaurant:Restaurant;lines:LocalLine[];ready:boolean;add:(line:LocalLine)=>void;quantity:(index:number,n:number)=>void;clear:()=>void};
const Context=createContext<CartContext|null>(null);
export function useCart(){const c=useContext(Context);if(!c)throw new Error("Missing restaurant context");return c;}
export function Storefront({restaurant:r,children}:{restaurant:Restaurant;children:ReactNode}){
  const [lines,setLines]=useState<LocalLine[]>([]);const [ready,setReady]=useState(false);const path=usePathname();const key=`zayqora-cart:${r.slug}`;
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||"[]");if(Array.isArray(saved))setLines(saved.filter(l=>typeof l.menu_item_id==="string"&&Number.isInteger(l.quantity)&&l.quantity>0&&l.quantity<=50&&Array.isArray(l.modifier_ids)).slice(0,50));}catch{}setReady(true);},[key]);
  function update(next:LocalLine[]){setLines(next);localStorage.setItem(key,JSON.stringify(next));}
  const base=`/r/${r.slug}`;
  return <Context.Provider value={{restaurant:r,lines,ready,add:line=>update([...lines,line]),quantity:(i,n)=>update(mutateCart(lines,i,n)),clear:()=>update([])}}><Header/><div className="restaurant-bar"><div className="container restaurant-bar-inner"><Link href={base} className="restaurant-name">{r.logo_url&&<img src={r.logo_url} alt=""/>}<span>{r.name}<small>{r.slug==="saffron-table"?"Demonstration restaurant":`${r.cuisine} · ${r.city}`}</small></span></Link><nav aria-label="Restaurant"><Link aria-current={path===base?"page":undefined} href={base}>Home</Link><Link aria-current={path===`${base}/menu`?"page":undefined} href={`${base}/menu`}>Menu</Link><Link aria-current={path===`${base}/reservations`?"page":undefined} href={`${base}/reservations`}>Reserve</Link><Link aria-current={path===`${base}/about`?"page":undefined} href={`${base}/about`}>Our story</Link><Link aria-current={path===`${base}/contact`?"page":undefined} href={`${base}/contact`}>Visit us</Link></nav><Link className="button small" href={`${base}/cart`}>Bag <span className="count">{lines.reduce((s,l)=>s+l.quantity,0)}</span></Link></div></div>{children}<Footer/></Context.Provider>;
}
