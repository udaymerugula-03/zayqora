"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {api,send} from "@/lib/api";
import {dateTime,reservationTransitions} from "@/lib/commerce";
import type {Page,Reservation,Table} from "@/lib/types";
import {Badge,Dialog,Empty,Field,Loading,Notice,PageTitle} from "./ui";
import {ActionMessages,useAction} from "./workspace";
import {Pagination} from "./orders";
export function ReservationsAdmin(){
 const [tab,setTab]=useState("reservations");const [page,setPage]=useState(1);const [status,setStatus]=useState("");const [selected,setSelected]=useState<Reservation|null>(null);
 const q=useQuery({queryKey:["reservations",page,status],queryFn:()=>api<Page<Reservation>>(`/reservations?page=${page}&page_size=20&status=${status}`),refetchInterval:30_000});
 return <><PageTitle eyebrow="Make room for good company" title="Every table has a story."><p>Review requests and keep your dining tables up to date. Requested reservations hold capacity until resolved.</p></PageTitle><div className="category-tabs"><button className={tab==="reservations"?"selected":""} onClick={()=>setTab("reservations")}>Reservation requests</button><button className={tab==="tables"?"selected":""} onClick={()=>setTab("tables")}>Dining tables</button></div>{tab==="tables"?<DiningTables/>:<><div className="filter-bar"><Field label="Reservation status"><select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{Object.keys(reservationTransitions).map(s=><option key={s}>{s}</option>)}</select></Field></div>{q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry requests</button></Notice>:<section className="panel">{q.data.items.length?<div className="table-scroll"><table><thead><tr><th>Reference</th><th>Guest</th><th>Time · Karachi</th><th>Party</th><th>Status</th><th>Details</th></tr></thead><tbody>{q.data.items.map(r=><tr key={r.id}><td>{r.reference}</td><td>{r.customer_name}</td><td>{dateTime(r.starts_at)}</td><td>{r.party_size}</td><td><Badge>{r.status}</Badge></td><td><button className="secondary small" onClick={()=>setSelected(r)}>Review</button></td></tr>)}</tbody></table></div>:<Empty>No reservation requests match these filters.</Empty>}<Pagination page={page} total={q.data.total} size={20} onChange={setPage}/></section>}</>}{selected&&<ReservationEditor value={selected} close={()=>setSelected(null)}/>}</>;
}
function ReservationEditor({value:r,close}:{value:Reservation;close:()=>void}){
  const [status,setStatus]=useState("");
  const action=useAction();
  const requiresReason=["DECLINED","CANCELLED"].includes(status);
  return <Dialog title={r.reference} onClose={close}>
    <Badge>{r.status}</Badge><h3>{r.customer_name} · {r.party_size} guest(s)</h3>
    <p>{dateTime(r.starts_at)} — {dateTime(r.ends_at)}</p><p>{r.email}<br/>{r.phone}</p><p>{r.notes}</p>
    <p className="fine">Allocated table ID: {r.table_id}</p>
    <form onSubmit={async e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);
      const result=await action.run(()=>send(`/reservations/${r.id}/status`,{status,reason:String(f.get("reason")||"").trim()||undefined},"PATCH"),"Reservation status saved.");
      if(result)close();
    }}>
      <Field label="Next status"><select required value={status} onChange={e=>setStatus(e.target.value)}><option value="">Choose valid action</option>{(reservationTransitions[r.status]||[]).map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label={requiresReason?"Reason (required, at least 3 characters)":"Reason (optional)"}><textarea required={requiresReason} minLength={requiresReason?3:undefined} name="reason" maxLength={500}/></Field>
      <ActionMessages action={action}/><button disabled={!status||action.busy}>Save reservation status</button>
    </form>
  </Dialog>;
}
function DiningTables(){
 const q=useQuery({queryKey:["tables"],queryFn:()=>api<{items:Table[]}>("/tables")});const [selected,setSelected]=useState<Table|null|undefined>();return <><button onClick={()=>setSelected(null)}>+ Add dining table</button><p className="fine">Capacity and availability are checked by the server. Editing a table is not a guarantee of reservation acceptance.</p>{q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry tables</button></Notice>:<div className="table-card-grid">{q.data.items.map(t=><article className="panel" key={t.id}><span className="table-illustration" aria-hidden="true">▤</span><h2>{t.name}</h2><p>{t.capacity} seats</p><Badge>{t.active?"active":"inactive"}</Badge><p><button className="secondary small" onClick={()=>setSelected(t)}>Edit table</button></p></article>)}{!q.data.items.length&&<Empty>No dining tables yet. Add a table to begin taking reservations.</Empty>}</div>}{selected!==undefined&&<TableEditor value={selected} close={()=>setSelected(undefined)}/>}</>;
}
function TableEditor({value,close}:{value:Table|null;close:()=>void}){
  const action=useAction();
  return <Dialog title={value?"Edit dining table":"New dining table"} onClose={close}><form onSubmit={async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    const result=await action.run(()=>send(value?`/tables/${value.id}`:"/tables",{
      name:f.get("name"),capacity:Number(f.get("capacity")),active:f.get("active")==="on"
    },value?"PATCH":"POST"));if(result)close();
  }}>
    <Field label="Table name"><input name="name" required maxLength={80} defaultValue={value?.name}/></Field>
    <Field label="Seats"><input name="capacity" type="number" required min="1" max="30" defaultValue={value?.capacity||2}/></Field>
    <label className="choice"><input name="active" type="checkbox" defaultChecked={value?.active??true}/>Active for reservations</label>
    <ActionMessages action={action}/><button disabled={action.busy}>Save table</button>
  </form></Dialog>;
}
