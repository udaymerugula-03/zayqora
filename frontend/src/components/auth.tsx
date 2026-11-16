"use client";
import {useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {useForm} from "react-hook-form";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import Link from "next/link";
import {send} from "@/lib/api";
import type {User} from "@/lib/types";
import {Field,Notice,Loading} from "./ui";
export function AuthExperience({children}:{children:React.ReactNode}){
  return <div className="auth-experience"><aside className="auth-editorial"><img src="/food/hero.jpg" alt="A welcoming restaurant dining room"/><div><span className="eyebrow">The people behind the experience</span><h2>Great hospitality.<br/><em>Beautifully organised.</em></h2><p>Your menu, your guests, your next chapter.<br/>One considered space for it all.</p><span className="auth-editorial-footer">ZAYQORA · THE RESTAURANT WORKSPACE</span></div></aside><div className="auth-form-side">{children}<div className="auth-assurance"><span>Tab-scoped sessions</span><span>Owner &amp; platform access</span></div></div></div>;
}

const loginSchema=z.object({
  email:z.email("Enter a valid email address."),
  password:z.string().min(1,"Enter your password.")
});
const registerSchema=loginSchema.extend({
  password:z.string().min(12,"Use at least 12 characters.").max(128),
  full_name:z.string().min(2,"Enter your name.").max(120),
  restaurant_name:z.string().min(2,"Enter a restaurant name.").max(160),
  slug:z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"Use lowercase letters, numbers and single hyphens.")
});
type AuthFields=z.infer<typeof registerSchema>;
export function AuthForm({register:creating=false}:{register?:boolean}) {
  const router=useRouter();
  const client=useQueryClient();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<AuthFields>({resolver:zodResolver(creating?registerSchema:loginSchema) as never});
  async function submit(data:AuthFields){
    setError("");
    try {
      if(creating){
        const result=await send<{message:string;email_delivery_status:string}>("/auth/register",data);
        setMessage(`${result.message} Email delivery: ${result.email_delivery_status}. If delivery is not configured, contact the platform administrator; no message is assumed sent.`);
      }else{
        const result=await send<{access_token:string;user:User}>("/auth/login",{email:data.email,password:data.password});
        client.clear();
        sessionStorage.setItem("zayqora-token",result.access_token);
        router.replace(result.user.role==="platform_admin"?"/platform/overview":"/app/dashboard");
      }
    }catch(e){setError((e as Error).message);}
  }
  return <div className="auth-card">
    <div className="auth-step"><span>✦</span><small>{creating?"Your restaurant journey begins here":"Your workspace awaits"}</small></div>
    <h1>{creating?"Make yourself at home.":"Welcome back."}</h1>
    <p>{creating?"Create your owner account. Verify your email before signing in.":"Sign in to your owner or VIRELEO platform workspace."}</p>
    {message?<Notice>{message}<p><Link href="/login">Return to sign in</Link></p></Notice>:<form onSubmit={handleSubmit(submit)} noValidate>
      {creating&&<>
        <Field label="Full name" error={errors.full_name?.message}><input autoComplete="name" {...register("full_name")}/></Field>
        <Field label="Restaurant name" error={errors.restaurant_name?.message}><input {...register("restaurant_name")}/></Field>
        <Field label="Restaurant URL name" error={errors.slug?.message}><input placeholder="your-restaurant" {...register("slug")}/></Field>
      </>}
      <Field label="Email address" error={errors.email?.message}><input type="email" autoComplete="email" {...register("email")}/></Field>
      <Field label={creating?"Password · at least 12 characters":"Password"} error={errors.password?.message}><input type="password" autoComplete={creating?"new-password":"current-password"} {...register("password")}/></Field>
      {error&&<Notice error>{error}</Notice>}
      <button disabled={isSubmitting} className="full">{isSubmitting?"Please wait…":creating?"Create restaurant account":"Sign in →"}</button>
    </form>}
    <p className="fine">{creating?<>Already have an account? <Link href="/login">Sign in</Link></>:<>New to ZAYQORA? <Link href="/register">Create your restaurant</Link></>}</p>
  </div>;
}
export function VerifyEmail(){
  const token=useSearchParams().get("token");
  const q=useQuery({
    queryKey:["verify-email",token],
    queryFn:()=>send<{message:string}>("/auth/verify-email",{token}),
    enabled:!!token,
    staleTime:Infinity,
    retry:false,
    refetchOnMount:false,
    refetchOnWindowFocus:false,
    refetchOnReconnect:false
  });
  return <div className="auth-card">
    <h1>Verify your email</h1>
    {!token?<Notice error>No verification token was provided. Open the complete link from your verification message.</Notice>:q.isPending?<Loading/>:q.isError?<>
      <Notice error>{q.error.message} If you have already verified this account, try signing in.</Notice>
      <button onClick={()=>q.refetch()}>Retry verification</button>
    </>:<Notice>{q.data.message}</Notice>}
    <Link href="/login" className="button secondary">Continue to sign in</Link>
  </div>;
}
