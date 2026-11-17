import type {Restaurant, WebsiteSettings} from "./types";
import {z} from "zod";

export function websiteSettings(restaurant: Pick<Restaurant, "website_settings">): WebsiteSettings {
  return {
    about_text: "", seo_title: "", seo_description: "", theme: "navy", typography: "editorial",
    reservations_enabled: true, gallery_enabled: false, faqs_enabled: false,
    gallery: [], faqs: [], cancellation_policy: "", homepage_sections: ["featured", "about", "hours"],
    ...restaurant.website_settings,
  };
}

export function isDemo(restaurant: Pick<Restaurant, "is_demo" | "slug">): boolean {
  return restaurant.is_demo ?? ["saffron-table", "garden-cafe"].includes(restaurant.slug);
}

export function isPublicRestaurant(restaurant: Pick<Restaurant,"is_demo"|"slug"|"published"|"status">): boolean {
  return restaurant.published && restaurant.status==="active" && !isDemo(restaurant);
}

export function canOrder(restaurant: Pick<Restaurant, "allow_delivery" | "allow_pickup">): boolean {
  return restaurant.allow_delivery || restaurant.allow_pickup;
}

export function safeImageUrl(value: string): boolean {
  if (/^\/(?:food|media)\/[^\s\\]+$/.test(value) && !value.includes("..")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}

export const websiteSettingsSchema=z.object({
  about_text:z.string().max(10000),seo_title:z.string().max(160),seo_description:z.string().max(320),
  theme:z.enum(["navy","emerald","terracotta"]),typography:z.enum(["editorial","sans"]),
  reservations_enabled:z.boolean(),gallery_enabled:z.boolean(),faqs_enabled:z.boolean(),
  gallery:z.array(z.object({image_url:z.string().refine(safeImageUrl,"Use an HTTPS image URL or a /food/ or /media/ path."),alt:z.string().trim().min(1,"Each gallery image needs alternative text.").max(200)})).max(30),
  faqs:z.array(z.object({question:z.string().trim().min(1,"Each FAQ needs a question.").max(200),answer:z.string().trim().min(1,"Each FAQ needs an answer.").max(3000)})).max(30),
  cancellation_policy:z.string().max(10000),
  homepage_sections:z.array(z.enum(["featured","about","gallery","hours"])).max(4).refine(items=>new Set(items).size===items.length,"Each homepage section can appear only once."),
});
