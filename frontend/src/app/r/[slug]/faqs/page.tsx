import {notFound} from "next/navigation";
import {getRestaurant,restaurantMetadata} from "@/lib/restaurant";
import {websiteSettings} from "@/lib/website";
import {PageTitle} from "@/components/ui";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;return restaurantMetadata(await getRestaurant(slug),"FAQs","/faqs");
}
export default async function FAQs({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=await getRestaurant(slug);const settings=websiteSettings(r);
  if(!settings.faqs_enabled||!settings.faqs.length)notFound();
  return <main id="main" className="container section narrow"><PageTitle eyebrow={r.name} title="A little clarity."/>{settings.faqs.map((faq,index)=><details className="panel restaurant-faq" key={index}><summary>{faq.question}</summary><p className="preserve-lines">{faq.answer}</p></details>)}</main>;
}
