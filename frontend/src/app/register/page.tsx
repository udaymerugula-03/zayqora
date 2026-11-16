import {Header,Footer} from "@/components/ui";
import {AuthExperience,AuthForm} from "@/components/auth";
export const metadata={title:"Create your restaurant"};
export default function Register(){return <><Header/><main id="main" className="auth-shell"><AuthExperience><AuthForm register/></AuthExperience></main><Footer/></>}
