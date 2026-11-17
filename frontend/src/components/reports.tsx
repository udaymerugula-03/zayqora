"use client";
import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import {dateTime,localDate,money} from "@/lib/commerce";
import type {Dashboard} from "@/lib/types";
import {Badge,Empty,Field,Loading,Notice,PageTitle} from "./ui";
import {useUser} from "./workspace";

export function Reports({report=false}:{report?:boolean}){
  const user=useUser();
  const [from,setFrom]=useState(localDate());
  const [to,setTo]=useState(localDate());
  const [range,setRange]=useState({from:localDate(),to:localDate()});
  const q=useQuery({queryKey:["reports",report,range],queryFn:()=>api<Dashboard>(report?`/reports/sales?from_date=${range.from}&to_date=${range.to}`:"/reports/dashboard")});
  const stats=q.data?[
    ["Orders today",String(q.data.orders_today),"orders_today"],
    ["Gross sales",money(q.data.gross_sales),"gross_sales"],
    ["Net sales",money(q.data.net_sales),"net_sales"],
    ["Pending orders",String(q.data.pending_orders),"pending_orders"],
    ["Average order value",money(q.data.average_order_value),"average_order_value"],
    ["Upcoming reservations",String(q.data.upcoming_reservations),"upcoming_reservations"]
  ]:[];
  return <>
    <PageTitle eyebrow={report?"Real numbers. Clear definitions.":"A fresh look at your restaurant"} title={report?"Your sales, in perspective.":`Hello, ${user.full_name.split(" ")[0]}.`}>
      <p>{report?"Choose a local date range. Only actual backend records are included; each metric retains the definition shown below.":"Orders, reservations and the details that need your attention."}</p>
      {!report&&<Link href="/app/setup" className="text-link">Restaurant setup checklist</Link>}
    </PageTitle>
    {!report&&<section className="workspace-welcome"><div><span className="eyebrow">A little clarity for your day</span><h2>Behind every great meal,<br/><em>a well-considered service.</em></h2><p>Your live restaurant snapshot. Cash orders, upcoming guests, and the details that matter.</p><div className="actions"><Link className="button" href="/app/orders">Manage orders ↗</Link><Link href="/app/reservations" className="text-link">Welcome your next guests →</Link></div></div><div className="welcome-image"><img src="/food/karahi.jpg" alt="Freshly prepared food"/><span>THE RESTAURANT WORKSPACE</span></div></section>}
    {report&&<form className="filter-bar" onSubmit={e=>{e.preventDefault();setRange({from,to});}}>
      <Field label="From · Karachi date"><input type="date" required value={from} max={to} onChange={e=>setFrom(e.target.value)}/></Field>
      <Field label="To · Karachi date"><input type="date" required min={from} value={to} onChange={e=>setTo(e.target.value)}/></Field>
      <button>Apply date range</button>
    </form>}
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry report</button></Notice>:<>
      <div className="stats-grid">{stats.map(([title,value,key],index)=><article className="stat-card" key={key}>
        <div className="stat-top"><span>{title}</span><span className="stat-index">0{index+1}</span></div><strong>{value}</strong><small>{q.data.definitions[key]||"Backend-calculated metric."}</small>
      </article>)}</div>
      {!report&&<div className="workspace-shortcuts"><Link href="/app/menu"><span>01</span><div><strong>Curate the menu</strong><small>Availability, prices &amp; the next favourite</small></div><b>↗</b></Link><Link href="/app/settings"><span>02</span><div><strong>Set the scene</strong><small>Restaurant details, imagery &amp; hours</small></div><b>↗</b></Link><Link href="/app/notifications"><span>03</span><div><strong>Check the outbox</strong><small>Real notification delivery states</small></div><b>↗</b></Link></div>}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="row between"><h2>Recent orders</h2><Link href="/app/orders" className="text-link">View orders →</Link></div>
          {q.data.recent_orders.length?<div className="table-scroll"><table>
            <thead><tr><th>Reference</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead>
            <tbody>{q.data.recent_orders.map(o=><tr key={o.id}><td>{o.reference}</td><td><Badge>{o.status}</Badge></td><td>{money(o.total)}</td><td>{dateTime(o.created_at)}</td></tr>)}</tbody>
          </table></div>:<Empty>No orders in this reporting period.</Empty>}
        </section>
        <section className="panel">
          <div className="section-caption"><span className="eyebrow">From the kitchen</span><h2>Top menu items</h2></div>
          {q.data.top_items.length?q.data.top_items.map((i,n)=><div className="top-item" key={`${i.name}-${n}`}><span className="rank">{n+1}</span><div><strong>{i.name}</strong><small>{i.quantity} ordered</small></div><strong>{money(i.revenue)}</strong></div>):<Empty>No item sales to report.</Empty>}
        </section>
      </div>
      <details className="panel"><summary>How these metrics are defined</summary><dl className="definitions">{Object.entries(q.data.definitions).map(([k,v])=><div key={k}><dt>{k.replaceAll("_"," ")}</dt><dd>{v}</dd></div>)}</dl></details>
    </>}
  </>;
}
