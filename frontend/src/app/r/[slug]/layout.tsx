import {Storefront} from "@/components/storefront";
import {getRestaurant} from "@/lib/restaurant";
export default async function RestaurantLayout({children,params}:{children:React.ReactNode;params:Promise<{slug:string}>}){const {slug}=await params;const restaurant=await getRestaurant(slug);return <Storefront restaurant={restaurant}>{children}</Storefront>;}
