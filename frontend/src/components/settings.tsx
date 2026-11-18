"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {api,send} from "@/lib/api";
import type {Restaurant,Page} from "@/lib/types";
import {dateTime} from "@/lib/commerce";
import {isDemo,isPublicRestaurant} from "@/lib/website";
import {Badge,Empty,Field,Loading,Notice,PageTitle} from "./ui";
import {ActionMessages,useAction} from "./workspace";
import {Upload} from "./upload";
import {Pagination} from "./orders";

export function Settings(){
  const q=useQuery({queryKey:["restaurant"],queryFn:()=>api<Restaurant>("/restaurant")});
  return <>
    <PageTitle eyebrow="The details make the difference" title="Your restaurant. Your way."><p>Keep restaurant information accurate. ZAYQORA branding stays consistent across all restaurant sites.</p></PageTitle>
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry settings</button></Notice>:<SettingsForm key={q.data.id} value={q.data}/>}
  </>;
}
function SettingsForm({value:r}:{value:Restaurant}){
  const action=useAction();
  const [logo,setLogo]=useState(r.logo_url||"");
  const [hero,setHero]=useState(r.hero_image_url||"");
  const [hours,setHours]=useState(r.opening_hours||{});
  const [published,setPublished]=useState(r.published);
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const text=(key:string)=>String(f.get(key)||"").trim();
    const payload={
      name:text("name"),tagline:text("tagline"),description:text("description"),cuisine:text("cuisine"),city:text("city"),address:text("address"),phone:text("phone"),email:text("email"),
      logo_url:logo,hero_image_url:hero,
      allow_pickup:f.get("allow_pickup")==="on",allow_delivery:f.get("allow_delivery")==="on",
      delivery_fee:Number(f.get("delivery_fee")).toFixed(2),minimum_order:Number(f.get("minimum_order")).toFixed(2),tax_rate:Number(f.get("tax_rate")).toFixed(2),tax_inclusive:f.get("tax_inclusive")==="on",
      reservation_duration_minutes:Number(f.get("reservation_duration_minutes")),reservation_buffer_minutes:Number(f.get("reservation_buffer_minutes")),reservation_days_ahead:Number(f.get("reservation_days_ahead")),
      opening_hours:hours,published
    };
    await action.run(()=>send<Restaurant>("/restaurant",payload,"PATCH"),"Restaurant settings saved. Publication is subject to server setup validation.");
  }
  return <div className="settings-layout"><nav className="settings-navigation" aria-label="Restaurant settings sections"><span className="eyebrow">Set the scene</span>{[["details","Restaurant details"],["imagery","Imagery & identity"],["pricing","Services & pricing"],["hours","Opening hours"],["rules","Reservation rules"],["publish","Publication"]].map(([id,label],index)=><a key={id} href={`#settings-${id}`}><span>0{index+1}</span>{label}</a>)}<p>Changes apply when you save the restaurant settings below.</p></nav><form onSubmit={save} className="settings-form">
    <ActionMessages action={action}/>
    <section id="settings-details" className="panel">
      <div className="row between wrap"><h2>Restaurant details</h2>{isPublicRestaurant(r)&&<Link className="text-link" href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer">View public site ↗</Link>}</div>
      <div className="form-grid">
        <Field label="Restaurant name"><input name="name" required minLength={2} maxLength={160} defaultValue={r.name}/></Field>
        <Field label="Tagline"><input name="tagline" maxLength={200} defaultValue={r.tagline}/></Field>
        <Field label="Cuisine"><input name="cuisine" required maxLength={100} defaultValue={r.cuisine}/></Field>
        <Field label="City"><input name="city" required maxLength={100} defaultValue={r.city}/></Field>
      </div>
      <Field label="Restaurant description"><textarea name="description" rows={4} maxLength={4000} defaultValue={r.description}/></Field>
      <Field label="Street address"><textarea name="address" required rows={2} maxLength={500} defaultValue={r.address}/></Field>
      <div className="form-grid">
        <Field label="Contact phone"><input name="phone" type="tel" required minLength={7} maxLength={30} defaultValue={r.phone}/></Field>
        <Field label="Contact email"><input name="email" type="email" required defaultValue={r.email}/></Field>
      </div>
      <p className="fine">Restaurant URL: /r/{r.slug} · Currency: PKR · Timezone: Asia/Karachi</p>
    </section>
    <section id="settings-imagery" className="panel">
      <h2>Restaurant imagery</h2>
      <p className="fine">Your restaurant identity is displayed beneath the shared ZAYQORA header, not as a replacement platform brand.</p>
      <div className="form-grid"><Upload label="Restaurant logo" value={logo} onChange={setLogo}/><Upload label="Hero photograph" value={hero} onChange={setHero}/></div>
    </section>
    <section id="settings-pricing" className="panel">
      <h2>Services &amp; pricing</h2>
      <div className="actions wrap">
        <label className="choice"><input name="allow_pickup" type="checkbox" defaultChecked={r.allow_pickup}/>Allow pickup</label>
        <label className="choice"><input name="allow_delivery" type="checkbox" defaultChecked={r.allow_delivery}/>Allow delivery</label>
        <label className="choice"><input name="tax_inclusive" type="checkbox" defaultChecked={r.tax_inclusive}/>Prices include tax</label>
      </div>
      <div className="form-grid">
        <Field label="Delivery fee · PKR"><input type="number" name="delivery_fee" required min="0" max="9999999" step="0.01" defaultValue={r.delivery_fee}/></Field>
        <Field label="Minimum order · PKR"><input type="number" name="minimum_order" required min="0" max="9999999" step="0.01" defaultValue={r.minimum_order}/></Field>
        <Field label="Tax rate · percent"><input type="number" name="tax_rate" required min="0" max="100" step="0.01" defaultValue={r.tax_rate}/></Field>
      </div>
      <Notice>Only cash on delivery and pickup are supported. Online payments are disabled.</Notice>
    </section>
    <section id="settings-hours" className="panel">
      <h2>Opening hours</h2><p className="fine">Use local Asia/Karachi times. A closed day will not offer reservation slots.</p>
      {["mon","tue","wed","thu","fri","sat","sun"].map(day=>{
        const h=hours[day]||{open:"12:00",close:"23:00",closed:false};
        function update(p:Partial<typeof h>){setHours({...hours,[day]:{...h,...p}});}
        return <div className="hours-editor" key={day}>
          <strong>{day}</strong><label className="choice"><input type="checkbox" checked={h.closed} onChange={e=>update({closed:e.target.checked})}/>Closed</label>
          <label><span className="sr-only">{day} opens</span><input type="time" required={!h.closed} disabled={h.closed} value={h.open} onChange={e=>update({open:e.target.value})}/></label>
          <span>to</span><label><span className="sr-only">{day} closes</span><input type="time" required={!h.closed} disabled={h.closed} value={h.close} onChange={e=>update({close:e.target.value})}/></label>
        </div>;
      })}
    </section>
    <section id="settings-rules" className="panel">
      <h2>Reservation rules</h2>
      <div className="form-grid">
        <Field label="Dining duration · minutes"><input type="number" name="reservation_duration_minutes" required min="15" max="360" defaultValue={r.reservation_duration_minutes}/></Field>
        <Field label="Buffer between tables · minutes"><input type="number" name="reservation_buffer_minutes" required min="0" max="180" defaultValue={r.reservation_buffer_minutes}/></Field>
        <Field label="Booking window · days ahead"><input type="number" name="reservation_days_ahead" required min="1" max="180" defaultValue={r.reservation_days_ahead}/></Field>
      </div>
      <Link href="/app/reservations">Manage dining tables and reservation requests →</Link>
    </section>
    <section id="settings-publish" className="panel">
      <h2>Publish your restaurant</h2>
      <p>The server checks your setup before publishing. Suspended restaurants cannot accept public orders or reservations.</p>
      <p>Platform status: <Badge>{r.status}</Badge></p>
      {isDemo(r)&&<Notice>This is a sample restaurant. Publishing enables labelled demonstration orders and reservations, not real restaurant service. Keep sample details fictional and use test information only.</Notice>}
      <label className="choice"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/>Publish restaurant website</label>
      <ActionMessages action={action}/><button disabled={action.busy}>{action.busy?"Saving restaurant…":"Save restaurant settings"}</button>
    </section>
  </form></div>;
}
type Notification={id:string;kind:string;subject:string;status:string;created_at:string};
export function Notifications(){
  const [page,setPage]=useState(1);
  const q=useQuery({queryKey:["notifications",page],queryFn:()=>api<Page<Notification>>(`/notifications?page=${page}&page_size=20`),refetchInterval:30_000});
  return <>
    <PageTitle eyebrow="Transparency, not assumed delivery" title="Your notification outbox."><p>Delivery state is reported by the backend. Queued, failed or unconfigured messages are not delivered emails.</p></PageTitle>
    <div className="outbox-guide"><span aria-hidden="true">✉</span><div><h2>A message in the outbox is only the beginning.</h2><p>Pending messages await processing. Failed or unconfigured entries are not delivered. A sent state reports the configured mail service&apos;s outcome—not proof of arrival in a guest&apos;s inbox.</p></div></div>
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry outbox</button></Notice>:<section className="panel">
      {q.data.items.length?<div className="table-scroll"><table>
        <thead><tr><th>Kind</th><th>Subject</th><th>Delivery state</th><th>Created · Karachi</th></tr></thead>
        <tbody>{q.data.items.map(n=><tr key={n.id}><td>{n.kind}</td><td>{n.subject}</td><td><Badge>{n.status}</Badge></td><td>{dateTime(n.created_at)}</td></tr>)}</tbody>
      </table></div>:<Empty>No outbox entries yet.</Empty>}
      <Pagination page={page} total={q.data.total} size={20} onChange={setPage}/>
    </section>}
  </>;
}
