import {Workspace} from "@/components/workspace";
export const metadata={title:"Platform administration",robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <Workspace platform>{children}</Workspace>}
