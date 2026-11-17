"use client";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {api,send} from "@/lib/api";
import type {Inquiry,Page} from "@/lib/types";
import {dateTime} from "@/lib/commerce";
import {Badge,Dialog,Empty,Field,Loading,Notice,PageTitle} from "./ui";
import {Pagination} from "./orders";
export function Inquiries() {
  const [page,setPage]=useState(1);const [selected,setSelected]=useState<Inquiry|null>(null);
  const q=useQuery({queryKey:["inquiries",page],queryFn:()=>api<Page<Inquiry>>(`/inquiries?page=${page}&page_size=20`),refetchInterval:30_000});
  return <><PageTitle eyebrow="Every connection matters" title="Your restaurant enquiries."><p>Messages submitted through your restaurant’s contact page. Read, resolve and reopen enquiries; email responses are sent using your email application.</p></PageTitle>{q.isPending?<Loading/>:q.isError?<Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry enquiries</button></Notice>:<section className="panel">{q.data.items.length?<div className="table-scroll"><table><thead><tr><th>Reference</th><th>From</th><th>Subject</th><th>Received · Karachi</th><th>Status</th><th>Details</th></tr></thead><tbody>{q.data.items.map(inquiry=><tr key={inquiry.id}><td>{inquiry.reference}</td><td>{inquiry.customer_name}<br/><small>{inquiry.email}</small></td><td>{inquiry.subject}</td><td>{dateTime(inquiry.created_at)}</td><td><Badge>{inquiry.status}</Badge></td><td><button className="secondary small" onClick={()=>setSelected(inquiry)}>Read enquiry</button></td></tr>)}</tbody></table></div>:<Empty>No enquiries yet. Messages from your public contact form will appear here.</Empty>}<Pagination page={page} total={q.data.total} size={20} onChange={setPage}/></section>}{selected&&<InquiryDetail key={selected.id} value={selected} close={()=>setSelected(null)}/>}</>;
}
function InquiryDetail({value,close}:{value:Inquiry;close:()=>void}) {
  const client=useQueryClient();const [inquiry,setInquiry]=useState(value);const [status,setStatus]=useState<Inquiry["status"]>(value.status);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  async function save(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;setBusy(true);setError("");setSaved(false);
    try{const updated=await send<Inquiry>(`/inquiries/${inquiry.id}`,{status},"PATCH");setInquiry(updated);setStatus(updated.status);await client.invalidateQueries({queryKey:["inquiries"]});setSaved(true);}
    catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <Dialog title={inquiry.reference} onClose={close}><Badge>{inquiry.status}</Badge><h3>{inquiry.subject}</h3><p>{inquiry.customer_name} · <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a><br/>{dateTime(inquiry.created_at)}</p><p className="preserve-lines enquiry-message">{inquiry.message}</p><p><a className="text-link" href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Re: ${inquiry.subject} [${inquiry.reference}]`)}`}>Reply using your email application ↗</a></p><p className="fine">Opening your email application does not send a reply automatically or record it in this inbox.</p><form onSubmit={save}><Field label="Enquiry status"><select value={status} onChange={event=>{setStatus(event.target.value as Inquiry["status"]);setSaved(false);}}><option value="new">New</option><option value="read">Read</option><option value="resolved">Resolved</option></select></Field>{error&&<Notice error>{error}</Notice>}{saved&&<Notice>Enquiry status saved.</Notice>}<button disabled={busy||status===inquiry.status}>{busy?"Saving status…":"Save enquiry status"}</button></form></Dialog>;
}
