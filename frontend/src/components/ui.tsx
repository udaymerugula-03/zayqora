"use client";
import Link from "next/link";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type ReactElement } from "react";
import { BRAND } from "@/lib/commerce";
export function Brand() { return <Link href="/" className="brand" aria-label="ZAYQORA home"><span className="brand-symbol" aria-hidden="true">Z<span>✦</span></span><span>{BRAND.name}<small>{BRAND.tagline}</small></span></Link>; }
export function Header() {
  const [open,setOpen]=useState(false);
  const menuToggle=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);menuToggle.current?.focus();}};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close);},[open]);
  return <header className="site-header"><div className="container header-inner"><Brand/><button ref={menuToggle} className="mobile-menu secondary small" aria-expanded={open} aria-controls="public-navigation" onClick={()=>setOpen(!open)}>{open?"Close":"Menu"} <span aria-hidden="true">{open?"×":"☰"}</span></button><nav id="public-navigation" className={open?"is-open":""} aria-label="Main navigation"><Link href="/#discover" onClick={()=>setOpen(false)}>Discover restaurants</Link><Link href="/pricing" onClick={()=>setOpen(false)}>For restaurateurs</Link><Link className="button small" href="/login" onClick={()=>setOpen(false)}>Workspace ↗</Link></nav></div></header>;
}
export function Footer() { return <footer><div className="container footer-grid"><div><Brand/><p className="footer-mission">A place for good food.<br/>A connection worth making.</p></div><div><span className="eyebrow">Find your next moment</span><nav aria-label="Explore"><Link href="/#discover">Restaurant collection</Link><Link href="/r/saffron-table">Saffron Table · Demo</Link><Link href="/pricing">Restaurant plans</Link></nav></div><div><span className="eyebrow">A little clarity</span><nav aria-label="Legal"><Link href="/privacy">Privacy notice</Link><Link href="/terms">Terms of use</Link><Link href="/login">Owner &amp; platform sign in</Link></nav></div></div><div className="container footer-bottom"><span>Pakistan · PKR · Asia/Karachi</span><span>Release 1 demonstration. Cash on delivery or pickup only. No online payments.</span></div></footer>; }
export function Notice({children, error = false}: {children: ReactNode; error?: boolean}) { return <div className={error ? "notice error" : "notice"} role={error ? "alert" : "status"}>{children}</div>; }
export function Loading() { return <div className="loading" role="status"><span className="loading-mark" aria-hidden="true">✦</span><div><strong>Setting the table…</strong><small>Loading the latest information.</small></div><span className="spinner"/></div>; }
export function Empty({children}: {children: ReactNode}) { return <div className="empty"><span className="empty-symbol" aria-hidden="true">◇</span><div>{children}</div></div>; }
export function Field({label, children, error}: {label: string; children: ReactNode; error?: string}) {
  const generated=useId();
  const child=isValidElement(children)?children as ReactElement<{id?:string;"aria-invalid"?:boolean;"aria-describedby"?:string}>:null;
  const id=child?.props.id||generated;
  return <label className="field" htmlFor={id}><span>{label}</span>{child?cloneElement(child,{id,"aria-invalid":error?true:undefined,"aria-describedby":error?`${id}-error`:child.props["aria-describedby"]}):children}{error&&<small id={`${id}-error`} className="field-error" role="alert">{error}</small>}</label>;
}
export function Badge({children}: {children: ReactNode}) { const text = String(children); return <span className={`badge ${/^(CANCELLED|REJECTED|DECLINED|suspended|failed)$/.test(text) ? "bad" : /^(COMPLETED|CONFIRMED|active|paid|sent|Available|Published)$/.test(text) ? "good" : ""}`}><span aria-hidden="true"/>{text.replaceAll("_"," ")}</span>; }
export function Dialog({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement as HTMLElement; dialog?.showModal(); return () => {dialog?.close(); previous?.focus();}; }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={e => { if(e.target === e.currentTarget) onClose(); }} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</dialog>;
}
export function PageTitle({eyebrow, title, children}: {eyebrow?: string; title: string; children?: ReactNode}) { return <div className="page-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div><div className="page-description">{children}</div></div>; }
