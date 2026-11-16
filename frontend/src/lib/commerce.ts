import type { CartLine, LocalLine, Quote } from "./types.ts";
export const BRAND = { name: "ZAYQORA", tagline: "Good food. Beautifully connected." } as const;
export const money = (value: string | number = 0) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
export const dateTime = (value: string) => new Intl.DateTimeFormat("en-PK", {timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
export const localDate = () => new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
export function cartInputs(lines: LocalLine[]): CartLine[] { return lines.map(({menu_item_id, quantity, variant_id, modifier_ids, notes}) => ({menu_item_id, quantity, variant_id, modifier_ids: [...modifier_ids].sort(), notes})); }
export function mutateCart(lines: LocalLine[], index: number, quantity: number): LocalLine[] { return lines.flatMap((line, i) => i !== index ? [line] : quantity <= 0 ? [] : [{...line, quantity: Math.min(50, Math.max(1, Math.floor(quantity)))}]); }
export function quoteFingerprint(quote: Quote): string { return JSON.stringify([quote.items, quote.subtotal, quote.delivery_fee, quote.tax, quote.total, quote.currency]); }
export function requestKey(previous: {payload: string; key: string} | null, payload: string, create: () => string): {payload: string; key: string} { return previous?.payload === payload ? previous : {payload, key: create()}; }
export const orderTransitions: Record<string, string[]> = {PENDING: ["CONFIRMED","REJECTED","CANCELLED"],CONFIRMED:["PREPARING","CANCELLED"],PREPARING:["READY","CANCELLED"],READY:["OUT_FOR_DELIVERY","COMPLETED"],OUT_FOR_DELIVERY:["COMPLETED"],COMPLETED:[],REJECTED:[],CANCELLED:[]};
export const reservationTransitions: Record<string, string[]> = {REQUESTED:["CONFIRMED","DECLINED","CANCELLED"],CONFIRMED:["SEATED","CANCELLED","NO_SHOW"],SEATED:["COMPLETED"],COMPLETED:[],CANCELLED:[],DECLINED:[],NO_SHOW:[]};
export function availableOrderActions(order:{status:string;fulfilment:string;payment_status:string}):string[]{
  return (orderTransitions[order.status]||[]).filter(next=>{
    if(order.payment_status==="paid"&&["CANCELLED","REJECTED"].includes(next))return false;
    if(next==="OUT_FOR_DELIVERY"&&order.fulfilment!=="delivery")return false;
    if(next==="COMPLETED"&&(order.payment_status!=="paid"||(order.fulfilment==="delivery"&&order.status!=="OUT_FOR_DELIVERY")))return false;
    return true;
  });
}
