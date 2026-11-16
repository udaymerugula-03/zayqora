"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {api,send} from "@/lib/api";
import {dateTime,localDate} from "@/lib/commerce";
import type {Reservation} from "@/lib/types";
import {useCart} from "./storefront";
import {Empty,Field,Loading,Notice,PageTitle,Badge} from "./ui";
export function PublicReservations(){
  const {restaurant:r}=useCart();
  const [date,setDate]=useState(localDate());
  const [size,setSize]=useState(2);
  const [slot,setSlot]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<Reservation|null>(null);
  const q=useQuery({
    queryKey:["availability",r.slug,date,size],
    queryFn:()=>api<{slots:{starts_at:string;ends_at:string}[]}>(`/public/restaurants/${r.slug}/availability?date=${encodeURIComponent(date)}&party_size=${size}`),
    enabled:!!date&&Number.isInteger(size)&&size>=1&&size<=30,retry:false
  });
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy)return;
    setBusy(true);setError("");
    const f=new FormData(e.currentTarget);
    try{
      const reservation=await send<Reservation>(`/public/restaurants/${r.slug}/reservations`,{
        starts_at:slot,party_size:size,customer_name:f.get("customer_name"),email:f.get("email"),phone:f.get("phone"),notes:f.get("notes"),consent:true
      });
      setResult(reservation);await q.refetch();
    }catch(e){setError((e as Error).message);setSlot("");await q.refetch();}
    finally{setBusy(false);}
  }
  const maxDate=new Date(`${localDate()}T12:00:00+05:00`);
  maxDate.setUTCDate(maxDate.getUTCDate()+r.reservation_days_ahead);
  return <main id="main" className="container section">
    <PageTitle eyebrow={`${r.name} · Make a little time for togetherness`} title="A table for your next moment.">
      <p>Check available slots in Pakistan time. Requests are reviewed by the restaurant.</p>
    </PageTitle>
    {result?<section className="panel narrow">
      <span className="eyebrow">Request received</span><h2>{result.reference}</h2><Badge>{result.status}</Badge>
      <p>{dateTime(result.starts_at)} · {result.party_size} guests</p>
      <Notice>Your table request has been submitted. A request is not a confirmation; contact the restaurant using the published details for updates. Email delivery is not guaranteed.</Notice>
      <Link className="button secondary" href={`/r/${r.slug}/contact`}>Restaurant contact details</Link>
    </section>:<div className="checkout-grid">
      <section className="panel">
        <h2>Find your table</h2>
        <div className="form-grid">
          <Field label="Date · Asia/Karachi"><input type="date" min={localDate()} max={maxDate.toISOString().slice(0,10)} value={date} onChange={e=>{setDate(e.target.value);setSlot("");}}/></Field>
          <Field label="Number of guests"><input type="number" min="1" max="30" value={size} onChange={e=>{setSize(Number(e.target.value));setSlot("");}}/></Field>
        </div>
        <h3>Available starting times</h3>
        {!date||!Number.isInteger(size)||size<1||size>30?<Notice error>Choose a date and a party size between 1 and 30.</Notice>:q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Check again</button></Notice>:q.data.slots.length?<div className="slots" role="group" aria-label="Available reservation slots">
          {q.data.slots.map(s=><button key={s.starts_at} className={slot===s.starts_at?"selected":"secondary"} onClick={()=>setSlot(s.starts_at)} aria-pressed={slot===s.starts_at}>
            {new Intl.DateTimeFormat("en-PK",{timeZone:"Asia/Karachi",hour:"numeric",minute:"2-digit"}).format(new Date(s.starts_at))}
          </button>)}
        </div>:<Empty>No available slots for this date and party size. Try another date.</Empty>}
        <p className="fine">A slot can be taken before you submit. The server checks table capacity and overlapping reservations when saving your request.</p>
      </section>
      <section className="panel">
        <h2>The little details</h2>
        <form onSubmit={submit}>
          <Field label="Full name"><input required name="customer_name" minLength={2} maxLength={120} autoComplete="name"/></Field>
          <div className="form-grid">
            <Field label="Email"><input required type="email" name="email" autoComplete="email"/></Field>
            <Field label="Phone"><input required type="tel" name="phone" minLength={7} maxLength={30} autoComplete="tel"/></Field>
          </div>
          <Field label="Notes (optional)"><textarea name="notes" maxLength={1000} rows={2}/></Field>
          <label className="choice consent"><input required type="checkbox"/><span>I agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy notice</Link>, and sharing these details with the restaurant for this request.</span></label>
          {r.slug==="saffron-table"&&<Notice>Demo restaurant. No real table or dining experience is provided.</Notice>}
          {error&&<Notice error>{error} If submission was interrupted, contact the restaurant before retrying to avoid duplicate requests.</Notice>}
          <button disabled={!slot||busy} className="full">{busy?"Submitting request…":"Request this table →"}</button>
        </form>
      </section>
    </div>}
  </main>;
}
