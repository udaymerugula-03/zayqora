import {Suspense} from "react";
import {Header,Footer,Loading} from "@/components/ui";
import {VerifyEmail} from "@/components/auth";
export const metadata={title:"Verify email"};
export default function Verify(){return <><Header/><main id="main" className="auth-shell"><Suspense fallback={<Loading/>}><VerifyEmail/></Suspense></main><Footer/></>}
