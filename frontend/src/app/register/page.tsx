import {Header,Footer} from "@/components/ui";
import {AuthForm} from "@/components/auth";
export const metadata={title:"Create your restaurant"};
export default function Register(){return <><Header/><main id="main" className="auth-shell"><AuthForm register/></main><Footer/></>}
