import Link from "next/link";
import {getRestaurant,restaurantMetadata} from "@/lib/restaurant";
import {websiteSettings,isDemo} from "@/lib/website";
import {Notice,PageTitle} from "@/components/ui";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;return restaurantMetadata(await getRestaurant(slug),"Restaurant policies","/policies");
}
export default async function Policies({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=await getRestaurant(slug);const settings=websiteSettings(r);
  return <main id="main" className="container section narrow"><PageTitle eyebrow={r.name} title="Restaurant policies."/><section className="panel"><h2>Cancellations &amp; restaurant terms</h2><p className="preserve-lines">{settings.cancellation_policy||"The restaurant has not published a cancellation policy. Contact the restaurant directly for cancellations, changes, allergens or other service questions. No restaurant-specific refund or cancellation entitlement is stated here."}</p><Link href={`/r/${slug}/contact`}>Contact {r.name} →</Link></section><section className="panel"><h2>Using ZAYQORA</h2><p>Orders use cash on delivery or pickup only; no online payment is taken. Totals and availability are checked by the restaurant service. Reservation requests require restaurant review; submitting a request is not a confirmed table.</p><p>Keep private order tracking links confidential. They give access to that order’s tracking information.</p><p><Link href="/terms">Platform terms of use</Link> · <Link href="/privacy">Platform privacy notice</Link></p></section>{isDemo(r)&&<Notice>This is a fictional demonstration restaurant. Orders and table requests do not provide real food or dining.</Notice>}</main>;
}
