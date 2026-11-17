import {notFound} from "next/navigation";
import {getRestaurant,restaurantMetadata} from "@/lib/restaurant";
import {websiteSettings} from "@/lib/website";
import {RestaurantGallery} from "@/components/restaurant-content";
import {PageTitle} from "@/components/ui";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;return restaurantMetadata(await getRestaurant(slug),"Gallery","/gallery");
}
export default async function Gallery({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=await getRestaurant(slug);const settings=websiteSettings(r);
  if(!settings.gallery_enabled||!settings.gallery.length)notFound();
  return <main id="main" className="container section"><PageTitle eyebrow={r.name} title="A closer look."/><RestaurantGallery restaurant={r}/></main>;
}
