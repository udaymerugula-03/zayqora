import {getRestaurant,restaurantMetadata} from "@/lib/restaurant";
import {isDemo} from "@/lib/website";
import {PageTitle} from "@/components/ui";
import {ContactForm} from "@/components/contact";
import {RestaurantHours} from "@/components/restaurant-content";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;return restaurantMetadata(await getRestaurant(slug),"Contact & opening hours","/contact");
}
export default async function Contact({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=await getRestaurant(slug);
  return <main id="main" className="container section contact-page"><PageTitle eyebrow={`${r.name} · A little closer`} title="Come for the food. Stay for the moment."><p>Find the restaurant, plan your visit, or get in touch.</p></PageTitle><div className="contact-grid"><div><div className="contact-photo"><img src={r.hero_image_url||"/food/hero.jpg"} alt={r.hero_image_url?`${r.name} cover photograph`:"Illustrative restaurant photograph"}/><span>{r.city}</span></div><section className="contact-details"><h2>Find us</h2><address>{r.address||"Address not yet published."}<br/>{r.city}</address>{r.address&&<p><a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.address,r.city].filter(Boolean).join(", "))}`} target="_blank" rel="noopener noreferrer">Open address in maps ↗</a></p>}<div className="contact-links">{r.phone&&<a href={`tel:${r.phone}`}><span>CALL THE RESTAURANT</span><strong>{r.phone}</strong><b>↗</b></a>}{r.email&&<a href={`mailto:${r.email}`}><span>WRITE TO THE RESTAURANT</span><strong>{r.email}</strong><b>↗</b></a>}</div>{isDemo(r)&&<p className="notice">Demo contact information. This restaurant is not a real fulfilment location.</p>}</section></div><div><section className="panel contact-hours"><RestaurantHours restaurant={r}/></section><ContactForm restaurant={r}/></div></div></main>;
}
