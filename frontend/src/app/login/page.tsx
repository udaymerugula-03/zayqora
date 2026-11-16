import {Header,Footer} from "@/components/ui";
import {AuthForm} from "@/components/auth";
export const metadata={title:"Sign in"};
export default function Login(){return <><Header/><main id="main" className="auth-shell"><AuthForm/></main><Footer/></>}
