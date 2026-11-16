"use client";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import {dateTime,money} from "@/lib/commerce";
import type {Order} from "@/lib/types";
import {Header,Footer,Badge,Loading,Notice,PageTitle} from "./ui";
export function Tracking({token}:{token:string}){
  const q=useQuery({queryKey:["tracking",token],queryFn:()=>api<Order>(`/public/orders/${encodeURIComponent(token)}`),refetchInterval:query=>query.state.data&&["COMPLETED","REJECTED","CANCELLED"].includes(query.state.data.status)?false:15_000,retry:false});
  return <><Header/><main id="main" className="container section tracking-page">
    <PageTitle eyebrow="A little update from the kitchen" title="Your order, at a glance."><p>A private connection to your restaurant order. Updates are provided by the restaurant, not live GPS.</p></PageTitle>
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry status</button></Notice>:<>
      <section className="tracking-overview"><div><span className="eyebrow">Current restaurant update</span><h2>{q.data.status.replaceAll("_"," ").toLowerCase()}</h2><p>{q.data.reference} · {q.data.fulfilment}<br/>Placed {dateTime(q.data.created_at)}</p></div><div className="tracking-receipt"><span>YOUR ORDER TOTAL</span><strong>{money(q.data.total)}</strong><Badge>{q.data.payment_status}</Badge></div></section>
      <div className="tracking-layout"><section className="panel"><div className="form-section-heading"><span>YOUR ORDER SNAPSHOT</span><h2>A little of what you love.</h2></div>{q.data.items.map((i,n)=><div className="summary-item" key={n}><div>{i.quantity} × {i.name}<small>{[i.variant_name,...i.modifier_names].filter(Boolean).join(" · ")}</small></div><span>{money(i.line_total)}</span></div>)}<Notice>{q.data.payment_status==="paid"?"The restaurant has recorded cash receipt.":"Pay in cash on pickup or delivery. No online payment has been taken."}</Notice><p className="fine">Keep this tracking link private. Customer contact information and delivery addresses are not displayed here.</p></section>
        <section className="panel tracking-history"><span className="eyebrow">From the restaurant</span><h2>Order updates</h2><ol className="timeline">{q.data.history.map((h,n)=><li key={n}><strong>{h.status.replaceAll("_"," ")}</strong><time>{dateTime(h.created_at)}</time>{h.reason&&<p>{h.reason}</p>}</li>)}</ol><button className="secondary small" onClick={()=>q.refetch()} disabled={q.isFetching}>{q.isFetching?"Refreshing…":"Refresh status"}</button><p className="fine">All times Asia/Karachi. No estimated arrival time is assumed.</p></section></div>
    </>}
  </main><Footer/></>;
}
