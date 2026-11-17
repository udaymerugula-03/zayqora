import type {MetadataRoute} from "next";
import {publicOrigin} from "@/lib/restaurant";
export const dynamic="force-dynamic";
export default function robots():MetadataRoute.Robots {
  const origin=publicOrigin();
  return {rules:{userAgent:"*",allow:"/",disallow:["/app/","/platform/","/api/","/track/","/login","/register","/verify-email"]},sitemap:origin?`${origin}/sitemap.xml`:undefined};
}
