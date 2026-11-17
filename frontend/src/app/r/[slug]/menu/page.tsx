import {PublicMenu} from "@/components/menu";
import {getRestaurant,restaurantMetadata} from "@/lib/restaurant";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return restaurantMetadata(await getRestaurant(slug),"Menu","/menu");}
export default function MenuPage(){return <PublicMenu/>}
