"use client";
import Link from "next/link";
import { cloneElement, isValidElement, useEffect, useId, useRef, type ReactNode, type ReactElement } from "react";
import { BRAND } from "@/lib/commerce";
export function Brand() { return <Link href="/" className="brand" aria-label="ZAYQORA home"><span className="brand-symbol" aria-hidden="true">Z<span>✦</span></span><span>{BRAND.name}<small>{BRAND.tagline}</small></span></Link>; }
export function Header() { return <header className="site-header"><div className="container header-inner"><Brand/><nav aria-label="Main navigation"><Link href="/#discover">Discover</Link><Link href="/pricing">For restaurants</Link><Link className="button small secondary" href="/login">Workspace ↗</Link></nav></div></header>; }
export function Footer() { return <footer><div className="container footer-grid"><Brand/><p>Made for good food, and the people behind it.<br/>Pakistan · PKR · Asia/Karachi</p><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div><div className="container fine">Release 1 demonstration. Cash on delivery or pickup only. No online payments.</div></footer>; }
export function Notice({children, error = false}: {children: ReactNode; error?: boolean}) { return <div className={error ? "notice error" : "notice"} role={error ? "alert" : "status"}>{children}</div>; }
export function Loading() { return <div className="loading" role="status"><span className="spinner"/>Loading fresh information…</div>; }
export function Empty({children}: {children: ReactNode}) { return <div className="empty">{children}</div>; }
export function Field({label, children, error}: {label: string; children: ReactNode; error?: string}) {
  const generated=useId();
  const child=isValidElement(children)?children as ReactElement<{id?:string;"aria-invalid"?:boolean;"aria-describedby"?:string}>:null;
  const id=child?.props.id||generated;
  return <label className="field" htmlFor={id}><span>{label}</span>{child?cloneElement(child,{id,"aria-invalid":error?true:undefined,"aria-describedby":error?`${id}-error`:child.props["aria-describedby"]}):children}{error&&<small id={`${id}-error`} className="field-error" role="alert">{error}</small>}</label>;
}
export function Badge({children}: {children: ReactNode}) { const text = String(children); return <span className={`badge ${/CANCELLED|REJECTED|DECLINED|suspended|failed/.test(text) ? "bad" : /COMPLETED|CONFIRMED|active|paid|sent/.test(text) && !/unpaid/.test(text) ? "good" : ""}`}>{text.replaceAll("_"," ")}</span>; }
export function Dialog({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement as HTMLElement; dialog?.showModal(); return () => {dialog?.close(); previous?.focus();}; }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={e => { if(e.target === e.currentTarget) onClose(); }} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</dialog>;
}
export function PageTitle({eyebrow, title, children}: {eyebrow?: string; title: string; children?: ReactNode}) { return <div className="page-title">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{children}</div>; }
