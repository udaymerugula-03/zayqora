export type Money = string;
export interface User { id: string; email: string; full_name: string; role: "owner" | "platform_admin"; restaurant_id: string | null; email_verified: boolean }
export interface Restaurant { id: string; slug: string; name: string; tagline: string; description: string; cuisine: string; city: string; address: string; phone: string; email: string; currency: string; timezone: string; logo_url: string; hero_image_url: string; published: boolean; status: string; allow_pickup: boolean; allow_delivery: boolean; delivery_fee: Money; minimum_order: Money; tax_rate: Money; tax_inclusive: boolean; opening_hours: Record<string, {open: string; close: string; closed: boolean}>; reservation_duration_minutes: number; reservation_buffer_minutes: number; reservation_days_ahead: number; plan_id: string | null }
export interface Option { id?: string; name: string; price_delta: Money }
export interface MenuItem { id: string; category_id: string; name: string; description: string; image_url: string; price: Money; available: boolean; published: boolean; featured: boolean; variant_required: boolean; variants: Option[]; modifiers: Option[] }
export interface Category { id: string; name: string; position: number; published: boolean; items: MenuItem[] }
export interface CartLine { menu_item_id: string; quantity: number; variant_id: string | null; modifier_ids: string[]; notes: string }
export interface LocalLine extends CartLine { name: string; image_url: string }
export interface Quote { items: {menu_item_id: string; name: string; quantity: number; variant_name: string | null; modifier_names: string[]; unit_price: Money; line_total: Money; notes: string}[]; subtotal: Money; delivery_fee: Money; tax: Money; total: Money; currency: string; quote_token: string }
export interface Order extends Quote { id: string; reference: string; tracking_token?: string; status: string; payment_status: string; payment_method: string; fulfilment: string; customer_name?: string; email?: string; phone?: string; address?: string; notes?: string; created_at: string; history: {status: string; created_at: string; reason?: string}[] }
export interface Reservation { id: string; reference: string; status: string; starts_at: string; ends_at: string; party_size: number; customer_name: string; email: string; phone: string; notes: string; table_id: string }
export interface Table { id: string; name: string; capacity: number; active: boolean }
export interface Plan { id: string; name: string; description: string; max_menu_items: number; active: boolean }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface Dashboard { orders_today: number; gross_sales: Money; net_sales: Money; pending_orders: number; average_order_value: Money; upcoming_reservations: number; recent_orders: Order[]; top_items: {name: string; quantity: number; revenue: Money}[]; definitions: Record<string,string> }
