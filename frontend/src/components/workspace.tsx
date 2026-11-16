"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {api,ApiError} from "@/lib/api";
import type {User} from "@/lib/types";
import {Brand,Loading,Notice} from "./ui";
const UserContext=createContext<User|null>(null);
export const useUser=()=>useContext(UserContext)!;
export function Workspace({platform=false,children}:{platform?:boolean;children:ReactNode}){
 const router=useRouter();const path=usePathname();const client=useQueryClient();const [error,setError]=useState("");const [loggingOut,setLoggingOut]=useState(false);
 const q=useQuery({queryKey:["session"],queryFn:()=>api<User>("/auth/me"),retry:false,staleTime:0});
 useEffect(()=>{if(q.error instanceof ApiError&&q.error.status===401){sessionStorage.removeItem("zayqora-token");client.clear();router.replace("/login");}if(q.data&&((q.data.role==="platform_admin")!==platform))router.replace(q.data.role==="platform_admin"?"/platform/overview":"/app/dashboard");},[q.error,q.data,platform,router,client]);
 async function logout(){setLoggingOut(true);try{await api("/auth/logout",{method:"POST"});sessionStorage.removeItem("zayqora-token");client.clear();router.replace("/login");}catch(e){setError((e as Error).message);}finally{setLoggingOut(false);}}
 const nav=platform?[["overview","Overview","◈"],["tenants","Restaurants","▦"],["plans","Plans","◇"]]:[["dashboard","Overview","◈"],["orders","Orders","☷"],["menu","Menu","▦"],["reservations","Reservations & tables","▤"],["reports","Reports","▥"],["settings","Restaurant settings","⚙"],["notifications","Notification outbox","✉"]];
 if(q.isPending)return <main id="main" className="container section"><Brand/><Loading/></main>;
 if(q.isError)return <main id="main" className="container section"><Brand/><Notice error>{q.error.message}<button onClick={()=>q.refetch()}>Retry sign-in check</button><Link href="/login">Sign in</Link></Notice></main>;
 if((q.data.role==="platform_admin")!==platform)return <Loading/>;
 return <UserContext.Provider value={q.data}><div className="workspace"><aside className="workspace-sidebar"><Brand/><div className="workspace-label">{platform?"VIRELEO · PLATFORM ADMIN":"RESTAURANT WORKSPACE"}</div><nav aria-label="Workspace">{nav.map(([url,label,icon])=><Link aria-current={path===`/${platform?"platform":"app"}/${url}`?"page":undefined} href={`/${platform?"platform":"app"}/${url}`} key={url}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav><div className="sidebar-bottom"><span className="avatar">{q.data.full_name.slice(0,1)}</span><div><strong>{q.data.full_name}</strong><small>{q.data.role.replaceAll("_"," ")}</small></div><button className="text-button" disabled={loggingOut} onClick={logout}>{loggingOut?"…":"Sign out"}</button></div></aside><div className="workspace-body"><header className="workspace-top"><span>{platform?"Platform administration":"Owner-operated · Release 1"}</span><div><span className="status-dot"/> Cash only <Link href="/">View ZAYQORA ↗</Link></div></header><main id="main" className="workspace-main">{error&&<Notice error>Sign out failed: {error}. Your session has not been assumed revoked.</Notice>}{children}</main><div className="workspace-foot">ZAYQORA · Good food. Beautifully connected. <span>PKR · Asia/Karachi</span></div></div></div></UserContext.Provider>;
}
export function useAction(){
 const client=useQueryClient();const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,setBusy]=useState(false);
 async function run<T>(action:()=>Promise<T>,message="Changes saved."){setError("");setSuccess("");setBusy(true);try{const result=await action();setSuccess(message);await client.invalidateQueries();return result;}catch(e){setError((e as Error).message);return undefined;}finally{setBusy(false);}}
 return {run,error,success,busy,reset:()=>{setError("");setSuccess("");}};
}
export function ActionMessages({action}:{action:ReturnType<typeof useAction>}){return <>{action.error&&<Notice error>{action.error}</Notice>}{action.success&&<Notice>{action.success}</Notice>}</>}
