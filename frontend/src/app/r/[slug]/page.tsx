import {RestaurantHomeContent} from "@/components/restaurant-content";
import {getPublicMenu, getRestaurant, restaurantMetadata} from "@/lib/restaurant";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params; return restaurantMetadata(await getRestaurant(slug),"Home");
}
export default async function RestaurantHome({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=await getRestaurant(slug);const menu=await getPublicMenu(slug);
  return <main id="main"><RestaurantHomeContent restaurant={r} categories={menu.categories}/></main>;
}
