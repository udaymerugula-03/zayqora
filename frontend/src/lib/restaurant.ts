import {notFound} from "next/navigation";
import type {Restaurant} from "./types";
export async function getRestaurant(slug:string):Promise<Restaurant>{
  const response=await fetch(`${process.env.API_ORIGIN||"http://127.0.0.1:8086"}/api/v1/public/restaurants/${encodeURIComponent(slug)}`,{cache:"no-store"});
  if(response.status===404)notFound();
  if(!response.ok)throw new Error("Restaurant service is currently unavailable. Please retry.");
  return response.json();
}
