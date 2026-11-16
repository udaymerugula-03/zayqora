import {Tracking} from "@/components/tracking";
export const metadata={title:"Private order status",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Track({params}:{params:Promise<{token:string}>}){const {token}=await params;return <Tracking token={token}/>}
