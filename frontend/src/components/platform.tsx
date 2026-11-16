"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {api,send} from "@/lib/api";
import type {Page,Restaurant,Plan} from "@/lib/types";
import {Badge,Dialog,Empty,Field,Loading,Notice,PageTitle} from "./ui";
import {ActionMessages,useAction} from "./workspace";
import {Pagination} from "./orders";
type Overview={total_tenants:number;active_tenants:number;suspended_tenants:number;published_restaurants:number;total_orders:number};

export function PlatformOverview(){
  const q=useQuery({queryKey:["platform-overview"],queryFn:()=>api<Overview>("/platform/overview")});
  return <>
    <PageTitle eyebrow="VIRELEO platform administration" title="The bigger picture. Clearly."><p>Actual tenant and order counts. No inferred revenue or recurring billing metrics.</p></PageTitle>
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry overview</button></Notice>:<div className="stats-grid">{Object.entries(q.data).map(([k,v])=><article className="stat-card" key={k}><span>{k.replaceAll("_"," ")}</span><strong>{v}</strong><small>Current platform records</small></article>)}</div>}
    <section className="panel"><h2>Release 1 operating scope</h2><p>Restaurant sites, cash orders, reservations and owner workspaces. VIRELEO manages restaurant access and plan entitlements; no online payment provider, subscription collection, staff POS or inventory suite is enabled.</p></section>
  </>;
}
export function Tenants(){
  const [page,setPage]=useState(1);
  const [search,setSearch]=useState("");
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<{restaurant:Restaurant;kind:"status"|"plan"}|null>(null);
  const q=useQuery({queryKey:["tenants",page,query],queryFn:()=>api<Page<Restaurant>>(`/platform/tenants?page=${page}&page_size=20&q=${encodeURIComponent(query)}`)});
  return <>
    <PageTitle eyebrow="VIRELEO · Restaurant access" title="A thoughtful home for every tenant."><p>Status and plan changes require an administrative reason. Access controls remain backend-authoritative.</p></PageTitle>
    <form className="filter-bar" onSubmit={e=>{e.preventDefault();setQuery(search);setPage(1);}}>
      <Field label="Search restaurants"><input value={search} onChange={e=>setSearch(e.target.value)}/></Field><button>Search tenants</button>
    </form>
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry tenants</button></Notice>:<section className="panel">
      {q.data.items.length?<div className="table-scroll"><table>
        <thead><tr><th>Restaurant</th><th>Status</th><th>Public site</th><th>Plan ID</th><th>Actions</th></tr></thead>
        <tbody>{q.data.items.map(r=><tr key={r.id}>
          <td><strong>{r.name}</strong><small>{r.slug} · {r.city}</small></td>
          <td><Badge>{r.status}</Badge></td><td>{r.published?"Published":"Draft"}</td><td>{r.plan_id||"Unassigned"}</td>
          <td><div className="actions wrap"><button className="secondary small" onClick={()=>setSelected({restaurant:r,kind:"status"})}>Change status</button><button className="secondary small" onClick={()=>setSelected({restaurant:r,kind:"plan"})}>Assign plan</button></div></td>
        </tr>)}</tbody>
      </table></div>:<Empty>No restaurants match your search.</Empty>}
      <Pagination page={page} total={q.data.total} size={20} onChange={setPage}/>
    </section>}
    {selected&&<TenantEditor value={selected.restaurant} kind={selected.kind} close={()=>setSelected(null)}/>}
  </>;
}
function TenantEditor({value:r,kind,close}:{value:Restaurant;kind:"status"|"plan";close:()=>void}){
  const action=useAction();
  const plans=useQuery({queryKey:["platform-plans"],queryFn:()=>api<{items:Plan[]}>("/platform/plans"),enabled:kind==="plan"});
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    const result=await action.run(()=>send(`/platform/tenants/${r.id}/${kind}`,{
      reason:String(f.get("reason")).trim(),...(kind==="status"?{status:f.get("status")}:{plan_id:f.get("plan_id")})
    },"PATCH"),"Tenant updated with administrative reason.");
    if(result)close();
  }
  return <Dialog title={`${kind==="status"?"Change status":"Assign plan"} · ${r.name}`} onClose={close}>
    <form onSubmit={save}>
      {kind==="status"?<Field label="Tenant status"><select name="status" defaultValue={r.status}><option value="active">Active</option><option value="suspended">Suspended</option></select></Field>:plans.isPending?<Loading/>:plans.isError?<Notice error>{plans.error.message}<button type="button" onClick={()=>plans.refetch()}>Retry plans</button></Notice>:<Field label="Plan entitlement"><select required name="plan_id" defaultValue={r.plan_id||""}><option value="">Choose a plan</option>{plans.data.items.filter(p=>p.active||p.id===r.plan_id).map(p=><option key={p.id} value={p.id}>{p.name} · {p.max_menu_items} menu items</option>)}</select></Field>}
      <Field label="Administrative reason (required, at least 5 characters)"><textarea name="reason" required minLength={5} maxLength={1000} rows={3}/></Field>
      <Notice>{kind==="status"?"Suspension hides the public site and prevents public orders and reservations.":"Changing entitlements is not a payment or billing action. Existing menu usage is validated by the server."}</Notice>
      <ActionMessages action={action}/><button disabled={action.busy||(kind==="plan"&&!plans.data)}>Save tenant change</button>
    </form>
  </Dialog>;
}
export function PlatformPlans(){
  const q=useQuery({queryKey:["platform-plans"],queryFn:()=>api<{items:Plan[]}>("/platform/plans")});
  const [selected,setSelected]=useState<Plan|null|undefined>();
  return <>
    <PageTitle eyebrow="VIRELEO · Honest entitlements" title="Plans with a clear purpose."><p>Define supported menu-item limits. No billing prices or recurring revenue are fabricated.</p></PageTitle>
    <button onClick={()=>setSelected(null)}>+ Create plan</button>
    {q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry plans</button></Notice>:<div className="plan-grid">
      {q.data.items.map(p=><section className="panel plan" key={p.id}><Badge>{p.active?"active":"inactive"}</Badge><h2>{p.name}</h2><p>{p.description}</p><h3>{p.max_menu_items} menu items</h3><button className="secondary" onClick={()=>setSelected(p)}>Edit entitlements</button></section>)}
      {!q.data.items.length&&<Empty>No plans configured.</Empty>}
    </div>}
    {selected!==undefined&&<PlanEditor value={selected} close={()=>setSelected(undefined)}/>}
  </>;
}
function PlanEditor({value,close}:{value:Plan|null;close:()=>void}){
  const action=useAction();
  return <Dialog title={value?"Edit plan":"Create plan"} onClose={close}><form onSubmit={async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    const result=await action.run(()=>send(value?`/platform/plans/${value.id}`:"/platform/plans",{
      name:String(f.get("name")).trim(),description:f.get("description"),max_menu_items:Number(f.get("max_menu_items")),active:f.get("active")==="on"
    },value?"PATCH":"POST"));if(result)close();
  }}>
    <Field label="Plan name"><input name="name" required minLength={2} maxLength={120} defaultValue={value?.name}/></Field>
    <Field label="Description"><textarea name="description" maxLength={2000} defaultValue={value?.description}/></Field>
    <Field label="Maximum menu items"><input type="number" required min="1" max="10000" name="max_menu_items" defaultValue={value?.max_menu_items||50}/></Field>
    <label className="choice"><input type="checkbox" name="active" defaultChecked={value?.active??true}/>Active for assignment</label>
    <ActionMessages action={action}/><button disabled={action.busy}>Save plan</button>
  </form></Dialog>;
}
