"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import {money} from "@/lib/commerce";
import type {Category,MenuItem,LocalLine} from "@/lib/types";
import {Dialog,Field,Loading,Notice,Empty,PageTitle} from "./ui";
import {useCart} from "./storefront";

export function PublicMenu(){
  const {restaurant,add,lines}=useCart();
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("");
  const [item,setItem]=useState<MenuItem|null>(null);
  const [added,setAdded]=useState("");
  const q=useQuery({queryKey:["menu",restaurant.slug],queryFn:()=>api<{categories:Category[]}>(`/public/restaurants/${restaurant.slug}/menu`)});
  const matches=(i:MenuItem)=>`${i.name} ${i.description}`.toLowerCase().includes(search.toLowerCase());
  return <main id="main" className="container section">
    <PageTitle eyebrow={`${restaurant.name} · Freshly prepared, thoughtfully served`} title="A little of what you love."><p>Find your favourites. Make them yours. Pay in cash.</p></PageTitle>
    <div className="menu-toolbar">
      <label className="search-field"><span className="sr-only">Search menu</span><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="What are you craving?"/></label>
      <Link className="button secondary" href={`/r/${restaurant.slug}/cart`}>View bag · {lines.reduce((s,l)=>s+l.quantity,0)}</Link>
    </div>
    {added&&<Notice>{added} added to your bag. <Link href={`/r/${restaurant.slug}/cart`}>Review your bag →</Link></Notice>}
    {lines.length>=50&&<Notice>The bag supports up to 50 item selections. Review your bag before adding another.</Notice>}
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry menu</button></Notice>:<>
      <div className="category-tabs" role="group" aria-label="Menu category">
        <button className={!category?"selected":""} aria-pressed={!category} onClick={()=>setCategory("")}>All dishes</button>
        {q.data.categories.map(c=><button className={category===c.id?"selected":""} aria-pressed={category===c.id} key={c.id} onClick={()=>setCategory(c.id)}>{c.name}</button>)}
      </div>
      {q.data.categories.filter(c=>!category||c.id===category).map(c=>{
        const items=c.items.filter(matches);
        return items.length?<section className="menu-section" key={c.id}>
          <h2>{c.name}</h2><div className="menu-grid">{items.map(i=><article className={`menu-card ${!i.available?"sold-out":""}`} key={i.id}>
            <div className="menu-image"><img src={i.image_url||"/food/hero.jpg"} alt={i.name} loading="lazy"/>{i.featured&&<span className="image-label">Kitchen selection</span>}</div>
            <div className="card-body">
              <div className="row between"><h3>{i.name}</h3>{!i.available&&<span className="badge">Sold out</span>}</div>
              <p>{i.description}</p>
              <div className="row between"><strong>{money(i.price)}{i.variants.length>0&&<small> base</small>}</strong><button className="small" disabled={!i.available||lines.length>=50} onClick={()=>setItem(i)}>Customise +</button></div>
            </div>
          </article>)}</div>
        </section>:null;
      })}
      {!q.data.categories.some(c=>(!category||c.id===category)&&c.items.some(matches))&&<Empty>No dishes match. Try another category or search.</Empty>}
    </>}
    {item&&<ItemDialog item={item} close={()=>setItem(null)} add={line=>{add(line);setAdded(item.name);setItem(null);}}/>}
    <p className="fine">Ingredient or allergy questions? Contact the restaurant before ordering. Menu images may be illustrative. Final totals are calculated by the restaurant service.</p>
  </main>;
}
function ItemDialog({item,close,add}:{item:MenuItem;close:()=>void;add:(line:LocalLine)=>void}){
  const [variant,setVariant]=useState("");
  const [modifiers,setModifiers]=useState<string[]>([]);
  const [quantity,setQuantity]=useState(1);
  const [notes,setNotes]=useState("");
  return <Dialog title={item.name} onClose={close}>
    <img className="dialog-food" src={item.image_url||"/food/hero.jpg"} alt={item.name}/>
    <p>{item.description}</p>
    <form onSubmit={e=>{e.preventDefault();add({menu_item_id:item.id,name:item.name,image_url:item.image_url,quantity,variant_id:variant||null,modifier_ids:modifiers,notes});}}>
      {item.variants.length>0&&<fieldset>
        <legend>Choose a variant {item.variant_required?"(required)":"(optional)"}</legend>
        {!item.variant_required&&<label className="choice"><input type="radio" name="variant" value="" checked={!variant} onChange={()=>setVariant("")}/>Standard</label>}
        {item.variants.map(v=><label className="choice" key={v.id}><input type="radio" name="variant" required={item.variant_required} value={v.id} checked={variant===v.id} onChange={()=>setVariant(v.id!)}/><span>{v.name}</span><strong>+ {money(v.price_delta)}</strong></label>)}
      </fieldset>}
      {item.modifiers.length>0&&<fieldset>
        <legend>Make it yours (optional extras)</legend>
        {item.modifiers.map(m=><label className="choice" key={m.id}><input type="checkbox" checked={modifiers.includes(m.id!)} onChange={e=>setModifiers(e.target.checked?[...modifiers,m.id!]:modifiers.filter(id=>id!==m.id))}/><span>{m.name}</span><strong>+ {money(m.price_delta)}</strong></label>)}
      </fieldset>}
      <div className="form-grid">
        <Field label="Quantity"><input type="number" min="1" max="50" required value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></Field>
        <Field label="Item notes (optional)"><input maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Preparation preferences"/></Field>
      </div>
      <p className="fine">Base price {money(item.price)}. Your current total will be confirmed by a live quote in the bag.</p>
      <button className="full" type="submit">Add to bag +</button>
    </form>
  </Dialog>;
}
