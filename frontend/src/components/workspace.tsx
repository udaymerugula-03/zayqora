"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {api,ApiError} from "@/lib/api";
import type {Restaurant,User} from "@/lib/types";
import {BRAND} from "@/lib/commerce";
import {isDemo} from "@/lib/website";
import {Brand,Loading,Notice} from "./ui";
const UserContext=createContext<User|null>(null);
export const useUser=()=>useContext(UserContext)!;
export function Workspace({platform=false,children}:{platform?:boolean;children:ReactNode}){
 const router=useRouter();const path=usePathname();const client=useQueryClient();const [error,setError]=useState("");const [loggingOut,setLoggingOut]=useState(false);const [menuOpen,setMenuOpen]=useState(false);const menuToggle=useRef<HTMLButtonElement>(null);
 const q=useQuery({queryKey:["session"],queryFn:()=>api<User>("/auth/me"),retry:false,staleTime:0});
 const restaurant=useQuery({queryKey:["restaurant"],queryFn:()=>api<Restaurant>("/restaurant"),enabled:!platform&&q.data?.role==="owner",retry:false});
 useEffect(()=>{if(q.error instanceof ApiError&&q.error.status===401){sessionStorage.removeItem("zayqora-token");client.clear();router.replace("/login");}if(q.data&&((q.data.role==="platform_admin")!==platform))router.replace(q.data.role==="platform_admin"?"/platform/overview":"/app/dashboard");},[q.error,q.data,platform,router,client]);
 async function logout(){setLoggingOut(true);try{await api("/auth/logout",{method:"POST"});sessionStorage.removeItem("zayqora-token");client.clear();router.replace("/login");}catch(e){setError((e as Error).message);}finally{setLoggingOut(false);}}
 const nav=platform?[["overview","Overview","◈"],["tenants","Restaurants","▦"],["plans","Plans","◇"]]:[["dashboard","Overview","◈"],["setup","Setup guide","◇"],["orders","Orders","☷"],["kitchen","Kitchen board","☷"],["menu","Menu","▦"],["reservations","Reservations & tables","▤"],["inquiries","Contact enquiries","✉"],["reports","Reports","▥"],["website","Website builder","▦"],["settings","Restaurant settings","⚙"],["notifications","Notification outbox","✉"]];
 useEffect(()=>{setMenuOpen(false);},[path,setMenuOpen]);
 useEffect(()=>{if(!menuOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape"){setMenuOpen(false);menuToggle.current?.focus();}};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close);},[menuOpen]);
 if(q.isPending)return <main id="main" className="container section"><Brand/><Loading/></main>;
 if(q.isError)return <main id="main" className="container section"><Brand/><Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry sign-in check</button><Link href="/login">Sign in</Link></Notice></main>;
 if((q.data.role==="platform_admin")!==platform)return <Loading/>;
 return <UserContext.Provider value={q.data}><div className={`workspace ${menuOpen?"workspace-menu-open":""}`}>
   <header className="workspace-mobile-header"><Brand/><button ref={menuToggle} className="secondary small" aria-expanded={menuOpen} aria-controls="workspace-sidebar" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?"Close":"Workspace menu"} <span aria-hidden="true">{menuOpen?"×":"☰"}</span></button></header>
   <aside id="workspace-sidebar" className="workspace-sidebar" style={{overflowY:"auto"}}><div className="workspace-brand"><Brand/><span className="workspace-edition">{platform?"PLATFORM ADMINISTRATION":"RESTAURANT WORKSPACE"}</span></div><div className="workspace-label">{platform?"PLATFORM ADMIN":"RESTAURANT OWNER"}</div>
     <nav aria-label="Workspace">{nav.map(([url,label,icon],index)=><Link aria-current={path===`/${platform?"platform":"app"}/${url}`?"page":undefined} href={`/${platform?"platform":"app"}/${url}`} key={url}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span><small>{String(index+1).padStart(2,"0")}</small></Link>)}</nav>
     <div className="sidebar-note"><span aria-hidden="true">✦</span><strong>Room for good things.</strong><p>{platform?"ZAYQORA platform administration, operated by VIRELEO.":"A clear workspace. A little more time for hospitality."}</p></div>
     <div className="sidebar-bottom"><span className="avatar">{q.data.full_name.slice(0,1)}</span><div><strong>{q.data.full_name}</strong><small>{q.data.role.replaceAll("_"," ")}</small></div><button className="text-button" disabled={loggingOut} onClick={logout}>{loggingOut?"…":"Sign out"}</button></div>
   </aside>
   <div className="workspace-body"><header className="workspace-top"><div className="workspace-breadcrumb"><span>{platform?"Platform":"Restaurant workspace"}</span><i>/</i><strong>{nav.find(([url])=>path.endsWith(`/${url}`))?.[1]||"Overview"}</strong></div><div><span className="cash-indicator"><span className="status-dot"/> Cash only · PKR</span><Link href="/">Visit ZAYQORA ↗</Link></div></header>
     <main id="main" className="workspace-main">{error&&<Notice error>Sign out failed: {error}. Your session has not been assumed revoked.</Notice>}{restaurant.isError&&<Notice error>{restaurant.error.message}<button onClick={()=>restaurant.refetch()}>Retry restaurant details</button></Notice>}{restaurant.data&&isDemo(restaurant.data)&&<Notice>Sample restaurant workspace. Orders, reservations and sales figures here are demonstration data, not real fulfilment or commercial revenue.</Notice>}{children}</main><div className="workspace-foot"><span>{BRAND.name} · {BRAND.tagline}</span><span>Pakistan · PKR · Asia/Karachi</span></div>
   </div>
 </div></UserContext.Provider>;
}
export function useAction(){
 const client=useQueryClient();const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);
 async function run<T>(action:()=>Promise<T>,message="Changes saved."){setError("");setSuccess("");setBusy(true);try{const result=await action();setSuccess(message);await client.invalidateQueries();return result;}catch(e){setError((e as Error).message);return undefined;}finally{setBusy(false);}}
 return {run,error,success,busy,reset:()=>{setError("");setSuccess("");}};
}
export function ActionMessages({action}:{action:ReturnType<typeof useAction>}){return <>{action.error&&<Notice error>{action.error}</Notice>}{action.success&&<Notice>{action.success}</Notice>}</>}
