import {Header,Footer} from "@/components/ui";
import {AuthExperience,AuthForm} from "@/components/auth";
export const metadata={title:"Sign in"};
export default function Login(){return <><Header/><main id="main" className="auth-shell"><AuthExperience><AuthForm/></AuthExperience></main><Footer/></>}
