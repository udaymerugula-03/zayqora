import {Suspense} from "react";
import {Header,Footer,Loading} from "@/components/ui";
import {AuthExperience,VerifyEmail} from "@/components/auth";
export const metadata={title:"Verify email"};
export default function Verify(){return <><Header/><main id="main" className="auth-shell"><AuthExperience><Suspense fallback={<Loading/>}><VerifyEmail/></Suspense></AuthExperience></main><Footer/></>}
