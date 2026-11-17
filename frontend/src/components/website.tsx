"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {api,send} from "@/lib/api";
import type {Category,Restaurant,WebsiteSettings} from "@/lib/types";
import {canOrder,safeImageUrl,websiteSettings,websiteSettingsSchema} from "@/lib/website";
import {Field,Loading,Notice,PageTitle} from "./ui";
import {Upload} from "./upload";
import {RestaurantHomeContent} from "./restaurant-content";
const sections=["featured","about","gallery","hours"] as const;
const sectionLabels={featured:"Featured menu",about:"About the restaurant",gallery:"Photo gallery",hours:"Hours & contact"};

export function WebsiteEditor() {
  const q=useQuery({queryKey:["restaurant"],queryFn:()=>api<Restaurant>("/restaurant")});
  return <><PageTitle eyebrow="One considered template. Your restaurant’s identity." title="Your website, beautifully yours."><p>Choose your palette, tell your story and arrange your homepage. Changes appear on the public site after saving; draft restaurants stay private.</p></PageTitle>{q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry website</button></Notice>:<WebsiteForm key={q.data.id} restaurant={q.data}/>}</>;
}

function WebsiteForm({restaurant:r}:{restaurant:Restaurant}) {
  const client=useQueryClient();
  const [settings,setSettings]=useState<WebsiteSettings>(()=>websiteSettings(r));
  const [saved,setSaved]=useState(()=>JSON.stringify(websiteSettings(r)));
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");
  const [device,setDevice]=useState<"desktop"|"tablet"|"mobile">("desktop");
  const menu=useQuery({queryKey:["admin-menu"],queryFn:()=>api<{items:Category[]}>("/menu/categories")});
  const dirty=JSON.stringify(settings)!==saved;
  function update<K extends keyof WebsiteSettings>(key:K,value:WebsiteSettings[K]) {
    setSettings(previous=>({...previous,[key]:value}));setSuccess("");
  }
  function moveSection(index:number,offset:number) {
    const reordered=[...settings.homepage_sections];const other=index+offset;
    if(other<0||other>=reordered.length)return;
    [reordered[index],reordered[other]]=[reordered[other],reordered[index]];
    update("homepage_sections",reordered);
  }
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;setError("");setSuccess("");
    const result=websiteSettingsSchema.safeParse(settings);
    if(!result.success){setError(result.error.issues.map(issue=>`${issue.path.join(".")}: ${issue.message}`).join(" "));return;}
    setBusy(true);
    try {
      const updated=await send<Restaurant>("/restaurant",{website_settings:result.data},"PATCH");
      const persisted=websiteSettings(updated);setSettings(persisted);setSaved(JSON.stringify(persisted));
      client.setQueryData(["restaurant"],updated);
      await Promise.all([client.invalidateQueries({queryKey:["restaurant"]}),client.invalidateQueries({queryKey:["discovery"]}),client.invalidateQueries({queryKey:["menu",r.slug]})]);
      setSuccess(updated.published?"Website settings saved. Your published restaurant now uses these settings.":"Website draft saved. Your restaurant is still unpublished; use the setup checklist when you are ready.");
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  const previewRestaurant={...r,website_settings:{...settings,gallery:settings.gallery.filter(image=>safeImageUrl(image.image_url))}};
  return <div className="website-editor">
    <div className="panel row between wrap"><div><strong>{r.published?"Published restaurant":"Unpublished draft"}</strong><p className="fine">{dirty?"You have unsaved website changes.":"Website settings match the last saved version."} Saving settings does not change publication status.</p></div><div className="actions wrap"><Link className="button secondary small" href="/app/settings">Identity, images &amp; opening hours</Link><Link className="button secondary small" href="/app/setup">Setup &amp; publication</Link>{r.published&&<Link className="text-link" href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer">Open saved public site ↗</Link>}</div></div>
    <form onSubmit={save} className="website-settings-form">
      <fieldset disabled={busy}>
        <section className="panel"><h2>Look &amp; feel</h2><p className="fine">Controlled presets preserve the shared ZAYQORA design. Your logo and cover photo are managed in restaurant settings.</p><div className="form-grid">
          <Field label="Colour palette"><select value={settings.theme} onChange={event=>update("theme",event.target.value as WebsiteSettings["theme"])}><option value="navy">Midnight navy</option><option value="emerald">Deep emerald</option><option value="terracotta">Warm terracotta</option></select></Field>
          <Field label="Typography"><select value={settings.typography} onChange={event=>update("typography",event.target.value as WebsiteSettings["typography"])}><option value="editorial">Editorial serif</option><option value="sans">Modern sans serif</option></select></Field>
        </div></section>
        <section className="panel"><h2>Your story &amp; search appearance</h2>
          <Field label="About your restaurant"><textarea rows={6} maxLength={10000} value={settings.about_text} onChange={event=>update("about_text",event.target.value)}/></Field><p className="fine">If blank, your restaurant description is used. Write only accurate restaurant information.</p>
          <Field label="SEO title"><input maxLength={160} value={settings.seo_title} onChange={event=>update("seo_title",event.target.value)} placeholder={r.name}/></Field>
          <Field label="SEO description"><textarea rows={3} maxLength={320} value={settings.seo_description} onChange={event=>update("seo_description",event.target.value)} placeholder={r.description}/></Field>
        </section>
        <section className="panel"><h2>Services &amp; homepage sections</h2>
          <label className="choice"><input type="checkbox" checked={settings.reservations_enabled} onChange={event=>update("reservations_enabled",event.target.checked)}/>Accept online reservations</label>
          <p className="fine">Turning this off hides reservation links and stops new online requests. Existing requests remain in your workspace. Delivery and pickup are managed in <Link href="/app/settings#settings-pricing">service settings</Link>.</p>
          <h3>Homepage order</h3><p className="fine">The restaurant introduction always appears first. Enabled sections appear in the order below. A gallery also needs gallery visibility enabled and at least one photo.</p>
          <div className="homepage-section-list">{settings.homepage_sections.map((section,index)=><div className="row between wrap" key={section}><label className="choice"><input type="checkbox" checked onChange={()=>update("homepage_sections",settings.homepage_sections.filter(item=>item!==section))}/>{sectionLabels[section]}</label><div className="actions"><button type="button" className="secondary small" disabled={index===0} aria-label={`Move ${sectionLabels[section]} up`} onClick={()=>moveSection(index,-1)}>↑ Up</button><button type="button" className="secondary small" disabled={index===settings.homepage_sections.length-1} aria-label={`Move ${sectionLabels[section]} down`} onClick={()=>moveSection(index,1)}>↓ Down</button></div></div>)}
          {sections.filter(section=>!settings.homepage_sections.includes(section)).map(section=><label className="choice" key={section}><input type="checkbox" checked={false} onChange={()=>update("homepage_sections",[...settings.homepage_sections,section])}/>{sectionLabels[section]} <span className="muted">— hidden</span></label>)}</div>
        </section>
        <section className="panel"><div className="row between wrap"><h2>Photo gallery</h2><span className="fine">{settings.gallery.length}/30 photos</span></div>
          <label className="choice"><input type="checkbox" checked={settings.gallery_enabled} onChange={event=>update("gallery_enabled",event.target.checked)}/>Show gallery page and navigation when photos are present</label>
          {settings.gallery.map((image,index)=><div className="website-entry" key={index}><h3>Photo {index+1}</h3><Upload label={`Gallery photo ${index+1}`} value={image.image_url} onChange={image_url=>update("gallery",settings.gallery.map((current,i)=>i===index?{...current,image_url}:current))}/><Field label={`Photo ${index+1} alternative text`}><input required maxLength={200} value={image.alt} onChange={event=>update("gallery",settings.gallery.map((current,i)=>i===index?{...current,alt:event.target.value}:current))}/></Field><button type="button" className="secondary small" onClick={()=>update("gallery",settings.gallery.filter((_,i)=>i!==index))}>Remove photo {index+1}</button></div>)}
          <button type="button" className="secondary" disabled={settings.gallery.length>=30} onClick={()=>update("gallery",[...settings.gallery,{image_url:"",alt:""}])}>+ Add gallery photo</button>
        </section>
        <section className="panel"><div className="row between wrap"><h2>Frequently asked questions</h2><span className="fine">{settings.faqs.length}/30 questions</span></div>
          <label className="choice"><input type="checkbox" checked={settings.faqs_enabled} onChange={event=>update("faqs_enabled",event.target.checked)}/>Show FAQs page and navigation when questions are present</label>
          {settings.faqs.map((faq,index)=><div className="website-entry" key={index}><Field label={`Question ${index+1}`}><input required maxLength={200} value={faq.question} onChange={event=>update("faqs",settings.faqs.map((current,i)=>i===index?{...current,question:event.target.value}:current))}/></Field><Field label={`Answer ${index+1}`}><textarea required rows={3} maxLength={3000} value={faq.answer} onChange={event=>update("faqs",settings.faqs.map((current,i)=>i===index?{...current,answer:event.target.value}:current))}/></Field><button type="button" className="secondary small" onClick={()=>update("faqs",settings.faqs.filter((_,i)=>i!==index))}>Remove question {index+1}</button></div>)}
          <button type="button" className="secondary" disabled={settings.faqs.length>=30} onClick={()=>update("faqs",[...settings.faqs,{question:"",answer:""}])}>+ Add question</button>
        </section>
        <section className="panel"><h2>Cancellation policy &amp; restaurant terms</h2><Field label="Your published cancellation policy"><textarea rows={6} maxLength={10000} value={settings.cancellation_policy} onChange={event=>update("cancellation_policy",event.target.value)}/></Field><p className="fine">This appears on your restaurant policies page. It does not replace the platform privacy notice or terms. Leave blank to state that no restaurant-specific cancellation policy has been published.</p></section>
      </fieldset>
      {error&&<Notice error>{error}</Notice>}{success&&<Notice>{success}</Notice>}<button disabled={busy||!dirty}>{busy?"Saving website…":"Save website settings"}</button>
    </form>
    <section className="panel website-preview-panel" aria-label="Website content preview"><div className="row between wrap"><div><h2>Responsive content preview</h2><p className="fine">An authenticated preview of your unsaved homepage content, palette and typography. Navigation is illustrative; checkout and reservation flows are not included. It works before publication.</p></div><div className="actions" role="group" aria-label="Preview device">{(["desktop","tablet","mobile"] as const).map(size=><button type="button" className={device===size?"small":"secondary small"} aria-pressed={device===size} key={size} onClick={()=>setDevice(size)}>{size[0].toUpperCase()+size.slice(1)}</button>)}</div></div>
      {menu.isError&&<Notice error>Menu preview could not load: {menu.error.message}<button onClick={()=>menu.refetch()}>Retry menu preview</button></Notice>}
      <div className="website-preview-scroll"><div className={`website-preview restaurant-template theme-${settings.theme} typography-${settings.typography}`} data-device={device}><div className="preview-restaurant-bar"><strong>{r.logo_url&&<img src={r.logo_url} alt=""/>}{r.name}</strong><div><span>Home</span><span>Menu</span>{canOrder(r)&&<span>Order online</span>}{settings.reservations_enabled&&<span>Reservations</span>}{settings.gallery_enabled&&settings.gallery.length>0&&<span>Gallery</span>}{settings.faqs_enabled&&settings.faqs.length>0&&<span>FAQs</span>}<span>About</span><span>Contact</span></div></div><RestaurantHomeContent restaurant={previewRestaurant} categories={menu.data?.items} preview/></div></div>
    </section>
  </div>;
}
