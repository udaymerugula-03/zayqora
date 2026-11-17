"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {api,send} from "@/lib/api";
import type {Category,Restaurant,Table,User} from "@/lib/types";
import {websiteSettings} from "@/lib/website";
import {Badge,Loading,Notice,PageTitle} from "./ui";
export function Setup() {
  const client=useQueryClient();const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");
  const restaurant=useQuery({queryKey:["restaurant"],queryFn:()=>api<Restaurant>("/restaurant")});
  const menu=useQuery({queryKey:["admin-menu"],queryFn:()=>api<{items:Category[]}>("/menu/categories")});
  const tables=useQuery({queryKey:["tables"],queryFn:()=>api<{items:Table[]}>("/tables")});
  const session=useQuery({queryKey:["session"],queryFn:()=>api<User>("/auth/me")});
  async function publish(published:boolean) {
    if(busy)return;setBusy(true);setError("");setSuccess("");
    try {
      const updated=await send<Restaurant>("/restaurant",{published},"PATCH");
      client.setQueryData(["restaurant"],updated);
      await Promise.all([client.invalidateQueries({queryKey:["restaurant"]}),client.invalidateQueries({queryKey:["discovery"]})]);
      setSuccess(updated.published?"Your restaurant is published. Open the public site to review it.":"Your restaurant is now an unpublished draft. The public site is no longer available.");
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  if(restaurant.isPending||menu.isPending||tables.isPending||session.isPending)return <Loading/>;
  if(restaurant.isError||menu.isError||tables.isError||session.isError)return <Notice error>{restaurant.error?.message||menu.error?.message||tables.error?.message||session.error?.message}<button onClick={()=>{void restaurant.refetch();void menu.refetch();void tables.refetch();void session.refetch();}}>Retry setup checks</button></Notice>;
  const r=restaurant.data;const settings=websiteSettings(r);const categories=menu.data.items;
  const availableItems=categories.filter(category=>category.published).flatMap(category=>category.items).filter(item=>item.published&&item.available);
  const days=["mon","tue","wed","thu","fri","sat","sun"];
  const profileReady=!!(r.name.trim()&&r.cuisine.trim()&&r.city.trim()&&r.address.trim()&&r.phone.trim()&&r.email.trim());
  const steps=[
    {title:"Verify your owner email",complete:session.data.email_verified,detail:session.data.email_verified?"Email verification is complete.":"Verify your email from the account verification screen before publishing.",href:"/verify-email",action:"Email verification"},
    {title:"Add restaurant details",complete:profileReady,detail:"Name, cuisine, city, address, phone and email identify your restaurant.",href:"/app/settings#settings-details",action:"Edit restaurant details"},
    {title:"Upload logo & cover",complete:!!(r.logo_url&&r.hero_image_url),detail:"Use your own logo and a truthful cover photograph. These are recommended branding steps.",href:"/app/settings#settings-imagery",action:"Manage imagery"},
    {title:"Set opening hours",complete:days.every(day=>!!r.opening_hours?.[day])&&days.some(day=>r.opening_hours?.[day]&&!r.opening_hours[day].closed),detail:"Publish each day’s opening hours or mark it closed.",href:"/app/settings#settings-hours",action:"Set opening hours"},
    {title:"Publish your menu",complete:availableItems.length>0,detail:`${availableItems.length} available published item(s) in published categories. Review prices, options and availability.`,href:"/app/menu",action:"Manage menu"},
    {title:"Choose services & dining tables",complete:(r.allow_pickup||r.allow_delivery||settings.reservations_enabled)&&(!settings.reservations_enabled||tables.data.items.some(table=>table.active)),detail:settings.reservations_enabled?`${tables.data.items.filter(table=>table.active).length} active dining table(s). Reservations need active table capacity; also review pickup and delivery settings.`:"Reservations are disabled. Review pickup and delivery services in restaurant settings.",href:settings.reservations_enabled?"/app/reservations":"/app/settings#settings-pricing",action:settings.reservations_enabled?"Manage dining tables":"Choose services"},
    {title:"Review website & policies",complete:!!settings.about_text.trim()&&!!settings.seo_title.trim()&&!!settings.seo_description.trim(),detail:"Review your story, search appearance, gallery, FAQs and policies. Optional content can remain empty; the preview uses your saved restaurant data.",href:"/app/website",action:"Edit & preview website"},
    {title:"Publish your restaurant",complete:r.published,detail:r.published?"The public restaurant website is available.":"Publication is checked by the server, including account and restaurant readiness.",href:"#setup-publication",action:"Review publication"},
  ];
  const complete=steps.filter(step=>step.complete).length;
  return <><PageTitle eyebrow="From first details to your first guest" title="Let’s set your table."><p>A guided setup checklist based on your saved restaurant data. These are readiness checks, not manually completed tasks. Optional branding and website recommendations do not override the server’s publication rules.</p></PageTitle><section className="panel"><div className="row between wrap"><div><Badge>{r.published?"Published":"Draft"}</Badge><h2>{complete} of {steps.length} setup checks met</h2></div><div className="actions wrap"><Link className="button secondary small" href="/app/website">Preview website content</Link><Link className="button secondary small" href="/app/settings">Restaurant settings</Link>{r.published&&<Link className="button small" href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer">Open public site ↗</Link>}</div></div><progress className="setup-progress" value={complete} max={steps.length} aria-label="Saved setup checks complete"/></section><ol className="setup-checklist">{steps.map((step,index)=><li className="panel" key={step.title}><span className={`setup-step ${step.complete?"complete":""}`} aria-label={step.complete?"Check met":"Needs attention"}>{step.complete?"✓":index+1}</span><div><h2>{step.title}</h2><p>{step.detail}</p><Link className="text-link" href={step.href}>{step.action} →</Link></div></li>)}</ol><section className="panel" id="setup-publication"><h2>{r.published?"Your restaurant is live.":"Ready to welcome guests?"}</h2><p>Saving content does not publish an unpublished restaurant. Publication makes your restaurant discoverable and its enabled services publicly available. Any server validation errors will be shown here.</p>{error&&<Notice error>{error}</Notice>}{success&&<Notice>{success}</Notice>}<button disabled={busy} className={r.published?"secondary":""} onClick={()=>publish(!r.published)}>{busy?"Saving publication…":r.published?"Unpublish restaurant":"Publish restaurant"}</button></section></>;
}
