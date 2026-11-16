"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {useQuery} from "@tanstack/react-query";
import {ApiError,send} from "@/lib/api";
import {cartInputs,money,quoteFingerprint,requestKey} from "@/lib/commerce";
import type {Quote,Order} from "@/lib/types";
import {useCart} from "./storefront";
import {Empty,Field,Loading,Notice,PageTitle} from "./ui";

const schema=z.object({
  customer_name:z.string().min(2,"Please enter your name.").max(120),
  email:z.email("Please enter a valid email address."),
  phone:z.string().min(7,"Please enter a valid phone number.").max(30).regex(/^[+\d ()-]+$/,"Use a valid telephone number."),
  address:z.string().max(500),notes:z.string().max(1000),
  consent:z.literal(true,{error:"Consent is required to place your order."})
});
type Contact=z.infer<typeof schema>;
export function Totals({quote}:{quote:Quote}){
  return <div className="totals">
    <div><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>
    <div><span>Delivery</span><span>{money(quote.delivery_fee)}</span></div>
    <div><span>Tax</span><span>{money(quote.tax)}</span></div>
    <div className="grand-total"><strong>Total · PKR</strong><strong>{money(quote.total)}</strong></div>
    <small>Cash only. No payment is taken online.</small>
  </div>;
}
export function CartCheckout({checkout=false}:{checkout?:boolean}){
  const {restaurant:r,lines,quantity,clear,ready}=useCart();
  const router=useRouter();
  const [fulfilment,setFulfilment]=useState(r.allow_pickup?"pickup":"delivery");
  const [confirmed,setConfirmed]=useState("");
  const [error,setError]=useState("");
  const [change,setChange]=useState(false);
  const last=useRef<Quote|null>(null);
  const pending=useRef<{payload:string;key:string}|null>(null);
  const [unresolved,setUnresolved]=useState(false);
  const [placing,setPlacing]=useState(false);
  const inputs=cartInputs(lines);
  const serialized=JSON.stringify(inputs);
  const storageKey=`zayqora-order-attempt:${r.slug}`;
  const quote=useQuery({
    queryKey:["quote",r.slug,serialized,fulfilment],
    queryFn:()=>send<Quote>(`/public/restaurants/${r.slug}/quote`,{items:inputs,fulfilment}),
    enabled:ready&&lines.length>0&&(r.allow_delivery||r.allow_pickup),
    staleTime:0,refetchOnWindowFocus:false,retry:false
  });
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<Contact>({resolver:zodResolver(schema),defaultValues:{address:"",notes:""}});
  useEffect(()=>{
    try{
      const saved=JSON.parse(sessionStorage.getItem(storageKey)||"null");
      if(saved&&typeof saved.payload==="string"&&typeof saved.key==="string"){pending.current=saved;setUnresolved(true);}
    }catch{}
  },[storageKey]);
  useEffect(()=>{setConfirmed("");setError("");last.current=null;setChange(false);},[serialized,fulfilment]);
  useEffect(()=>{
    if(quote.data){
      if(last.current&&quoteFingerprint(last.current)!==quoteFingerprint(quote.data))setChange(true);
      last.current=quote.data;
    }
  },[quote.data]);
  async function place(contact:Contact){
    if(!quote.data||confirmed!==quoteFingerprint(quote.data)||placing)return;
    if(pending.current){setError("Resolve the earlier submission using Retry original order before creating another order.");return;}
    if(fulfilment==="delivery"&&contact.address.trim().length<5){setError("A delivery address of at least 5 characters is required.");return;}
    const body={items:inputs,fulfilment,quote_token:quote.data.quote_token,...contact,address:fulfilment==="delivery"?contact.address:""};
    pending.current=requestKey(null,JSON.stringify(body),()=>crypto.randomUUID());
    sessionStorage.setItem(storageKey,JSON.stringify(pending.current));setUnresolved(true);
    await submitAttempt();
  }
  async function submitAttempt(){
    if(!pending.current||placing)return;
    setError("");setPlacing(true);
    try{
      const attempt=pending.current;
      const result=await send<Order>(`/public/restaurants/${r.slug}/orders`,JSON.parse(attempt.payload),"POST",{"Idempotency-Key":attempt.key});
      if(!result.tracking_token)throw new Error("The response did not contain a private tracking token. Retry the original request, or contact the restaurant; do not create a second order.");
      sessionStorage.removeItem(storageKey);pending.current=null;setUnresolved(false);clear();
      router.push(`/track/${encodeURIComponent(result.tracking_token)}`);
    }catch(e){
      setError((e as Error).message);
      if(e instanceof ApiError&&e.status>=400&&e.status<500&&![408,429].includes(e.status)){
        sessionStorage.removeItem(storageKey);pending.current=null;setUnresolved(false);setConfirmed("");setChange(true);
        await quote.refetch();
      }
    }finally{setPlacing(false);}
  }
  if(!ready)return <main id="main" className="container section"><Loading/></main>;
  if(unresolved)return <main id="main" className="container section narrow">
    <PageTitle eyebrow="Retry-safe cash ordering" title={placing?"Sending your order, safely.":"Let’s resolve your original order."}/>
    <section className="panel">
      <Notice>An order submission is in progress or its result was interrupted. The original details and idempotency key are preserved in this tab. Retrying sends the identical request, not a second order.</Notice>
      {error&&<Notice error>{error}</Notice>}
      <button disabled={placing} onClick={submitAttempt}>{placing?"Checking original submission…":"Retry original order"}</button>
      <p className="fine">Do not create a new order in another tab while the outcome is unknown. If you cannot resolve it, contact the restaurant.</p>
    </section>
  </main>;
  if(!lines.length)return <main id="main" className="container section"><PageTitle title="A little room for something good."/><Empty>Your bag is empty. <Link href={`/r/${r.slug}/menu`}>Explore the menu →</Link></Empty></main>;
  return <main id="main" className="container section checkout-page">
    <nav className="checkout-progress" aria-label="Order progress"><Link href={`/r/${r.slug}/menu`}><span>01</span> The menu</Link><Link aria-current={!checkout?"step":undefined} href={`/r/${r.slug}/cart`}><span>02</span> Your bag</Link><span aria-current={checkout?"step":undefined}><span>03</span> Cash checkout</span></nav>
    <PageTitle eyebrow={`${r.name} · ${checkout?"The final little details":"Made for your appetite"}`} title={checkout?"Good food is almost yours.":"Your bag of good things."}/>
    <div className="checkout-grid">
      <section className="panel">
        {checkout?<>
          <div className="form-section-heading"><span>01 / GUEST DETAILS</span><h2>Your details</h2><p>A few details to help the restaurant look after your order.</p></div>
          <form id="checkout-form" onSubmit={handleSubmit(place)} noValidate>
            <div className="form-grid">
              <Field label="Full name" error={errors.customer_name?.message}><input autoComplete="name" {...register("customer_name")}/></Field>
              <Field label="Email address" error={errors.email?.message}><input type="email" autoComplete="email" {...register("email")}/></Field>
            </div>
            <Field label="Phone number" error={errors.phone?.message}><input type="tel" autoComplete="tel" placeholder="+92" {...register("phone")}/></Field>
            {fulfilment==="delivery"&&<Field label="Delivery address" error={errors.address?.message}><textarea autoComplete="street-address" rows={3} {...register("address")}/></Field>}
            <Field label="Order notes (optional)" error={errors.notes?.message}><textarea rows={2} placeholder="Anything the restaurant should know?" {...register("notes")}/></Field>
            <label className="choice consent"><input type="checkbox" {...register("consent")}/><span>I agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy notice</Link>, and consent to sharing my details with this restaurant for this order.</span></label>
            {errors.consent&&<p role="alert" className="field-error">{errors.consent.message}</p>}
            {r.slug==="saffron-table"&&<Notice>Demonstration restaurant. This order will not result in real food delivery. Do not use sensitive personal details.</Notice>}
          </form>
        </>:<>
          <div className="form-section-heading"><span>YOUR SELECTION</span><h2>Freshly chosen</h2><p>A little of everything you&apos;re looking forward to.</p></div>
          {lines.map((l,i)=><div className="cart-line" key={i}>
            <img src={l.image_url||"/food/hero.jpg"} alt=""/>
            <div>
              <h3>{l.name}</h3>{l.variant_id&&<small>Variant selected</small>}{l.modifier_ids.length>0&&<small> · {l.modifier_ids.length} extra(s)</small>}{l.notes&&<p>{l.notes}</p>}
              <label className="quantity">Quantity <input aria-label={`Quantity for ${l.name}`} type="number" min="1" max="50" disabled={placing} value={l.quantity} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1)quantity(i,n);}}/></label>
              <button className="text-button" onClick={()=>quantity(i,0)}>Remove</button>
            </div>
          </div>)}
          <Link href={`/r/${r.slug}/menu`} className="text-link">← Add something else</Link>
        </>}
      </section>
      <aside className="panel order-summary">
        <span className="eyebrow">The final little details</span><h2>Order summary</h2>
        <fieldset><legend>How would you like your order?</legend><div className="fulfilment-options">
          {r.allow_pickup&&<label className="choice"><input type="radio" checked={fulfilment==="pickup"} disabled={placing} onChange={()=>setFulfilment("pickup")}/>Pickup</label>}
          {r.allow_delivery&&<label className="choice"><input type="radio" checked={fulfilment==="delivery"} disabled={placing} onChange={()=>setFulfilment("delivery")}/>Delivery</label>}
        </div></fieldset>
        {!r.allow_pickup&&!r.allow_delivery?<Notice error>This restaurant is not currently accepting orders.</Notice>:quote.isPending?<Loading/>:quote.isError?<Notice error>{quote.error.message}<button onClick={()=>quote.refetch()}>Refresh quote</button></Notice>:<>
          {quote.data.items.map((i,n)=><div className="summary-item" key={n}><div>{i.quantity} × {i.name}<small>{[i.variant_name,...i.modifier_names].filter(Boolean).join(" · ")}</small></div><span>{money(i.line_total)}</span></div>)}
          <Totals quote={quote.data}/>
          {checkout&&<>
            {change&&<Notice error>Prices, availability or the quote may have changed. Review the refreshed quote and explicitly confirm again. No order has been assumed placed.</Notice>}
            <label className="choice consent"><input type="checkbox" checked={confirmed===quoteFingerprint(quote.data)} onChange={e=>setConfirmed(e.target.checked?quoteFingerprint(quote.data):"")}/><span>I confirm this current total of <strong>{money(quote.data.total)}</strong>, payable in cash on {fulfilment}.</span></label>
          </>}
          {error&&<Notice error>{error} If the connection was interrupted, use the same details and retry; your order key is preserved.</Notice>}
          {checkout?<button type="submit" form="checkout-form" className="full" disabled={placing||isSubmitting||confirmed!==quoteFingerprint(quote.data)}>{placing?"Submitting safely…":"Place cash order →"}</button>:<Link className="button full" href={`/r/${r.slug}/checkout`}>Continue to checkout →</Link>}
        </>}
        <p className="fine">Server-calculated prices. Availability is checked again when your order is submitted.</p>
      </aside>
    </div>
  </main>;
}
