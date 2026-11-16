"use client";
import {useState} from "react";
import {api} from "@/lib/api";
import {Field,Notice} from "./ui";
export function Upload({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function upload(file:File|undefined){
    if(!file)return;
    setError("");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){
      setError("Use a JPEG, PNG or WebP photograph.");return;
    }
    if(file.size>4*1024*1024){setError("Image must be no larger than 4 MB.");return;}
    setBusy(true);
    try{
      const form=new FormData();form.set("file",file);
      const result=await api<{url:string}>("/media",{method:"POST",body:form});
      onChange(result.url);
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  return <div className="upload-field">
    <Field label={`${label} · JPEG, PNG or WebP, up to 4 MB`}>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>upload(e.target.files?.[0])}/>
    </Field>
    {busy&&<p role="status">Uploading photograph…</p>}
    {error&&<Notice error>{error}</Notice>}
    {value&&<div className="upload-preview"><img src={value} alt={`${label} preview`}/><button type="button" className="text-button" onClick={()=>onChange("")}>Remove image</button></div>}
    <Field label="Image path or HTTPS URL (bundled or uploaded)">
      <input value={value} placeholder="/food/biryani.jpg" pattern="(/food/.*|/media/.*|https://.+)" title="Use a /food/ or /media/ path, or the HTTPS URL returned by an image upload." onChange={e=>onChange(e.target.value)}/>
    </Field>
  </div>;
}
