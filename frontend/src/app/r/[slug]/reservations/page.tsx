import {PublicReservations} from "@/components/reservations";
import {getRestaurant,restaurantMetadata} from "@/lib/restaurant";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return restaurantMetadata(await getRestaurant(slug),"Reservations","/reservations");}
export default function Reservations(){return <PublicReservations/>}
