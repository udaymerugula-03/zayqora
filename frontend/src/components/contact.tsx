"use client";
import {useState} from "react";
import Link from "next/link";
import {send} from "@/lib/api";
import {isDemo} from "@/lib/website";
import type {Restaurant} from "@/lib/types";
import {Field,Notice} from "./ui";
type Receipt={reference:string;status:"received";notification_status:"queued"|"provider_not_configured"};
export function ContactForm({restaurant:r}:{restaurant:Restaurant}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [receipt,setReceipt]=useState<Receipt|null>(null);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;const form=event.currentTarget;const data=new FormData(form);
    setBusy(true);setError("");
    try {
      const result=await send<Receipt>(`/public/restaurants/${r.slug}/inquiries`,{
        customer_name:String(data.get("customer_name")||"").trim(),email:String(data.get("email")||"").trim(),
        subject:String(data.get("subject")||"").trim(),message:String(data.get("message")||"").trim(),consent:data.get("consent")==="on",
      });
      setReceipt(result);form.reset();
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <section className="panel contact-enquiry"><span className="eyebrow">Make a connection</span><h2>Send an enquiry</h2><p>For urgent order changes, allergies or reservation updates, call the restaurant directly.</p>
    {isDemo(r)&&<Notice>This is a demonstration restaurant. Do not send sensitive personal information; no real restaurant service is provided.</Notice>}
    {receipt?<><Notice>Your enquiry was saved. Reference: <strong>{receipt.reference}</strong>. {receipt.notification_status==="queued"?"An email notification has been queued; delivery is not guaranteed.":"Email notifications are not configured. Your message is available in the restaurant’s enquiry inbox."}</Notice><button type="button" className="secondary" onClick={()=>setReceipt(null)}>Send another enquiry</button></>:<form onSubmit={submit}>
      <div className="form-grid"><Field label="Your name"><input name="customer_name" autoComplete="name" required maxLength={150}/></Field><Field label="Email address"><input name="email" type="email" autoComplete="email" required maxLength={254}/></Field></div>
      <Field label="Subject"><input name="subject" required maxLength={160}/></Field>
      <Field label="Message"><textarea name="message" rows={5} required minLength={10} maxLength={5000}/></Field>
      <label className="choice"><input name="consent" type="checkbox" required/><span>I agree to share these details with {r.name} so they can respond, as described in the <Link href="/privacy">privacy notice</Link>.</span></label>
      {error&&<Notice error>{error}</Notice>}<button disabled={busy}>{busy?"Sending enquiry…":"Send enquiry"}</button>
    </form>}
  </section>;
}
