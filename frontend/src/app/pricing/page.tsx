import {Header, Footer, PageTitle} from "@/components/ui";
import {Plans} from "@/components/discovery";
export const metadata={title:"Restaurant plans"};
export default function Pricing(){return <><Header/><main id="main" className="container section"><PageTitle eyebrow="A place for your restaurant to grow" title="The tools. Not the complication."><p>Compare live plan entitlements. This release has no subscription checkout or online payment processing.</p></PageTitle><Plans/></main><Footer/></>}
