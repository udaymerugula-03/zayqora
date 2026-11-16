// Isolated contract fixtures for browser tests only; never imported by the application.
import {createServer} from "node:http";
const restaurant={id:"test-restaurant",slug:"saffron-table",name:"Saffron Table",tagline:"A little taste of togetherness.",description:"A demonstration of freshly prepared Pakistani classics, served with care.",cuisine:"Pakistani",city:"Lahore",address:"Demo address, Lahore",phone:"+923001234567",email:"demo@example.com",currency:"PKR",timezone:"Asia/Karachi",logo_url:"",hero_image_url:"/food/hero.jpg",published:true,status:"active",allow_pickup:true,allow_delivery:true,delivery_fee:"150.00",minimum_order:"0.00",tax_rate:"0.00",tax_inclusive:false,opening_hours:Object.fromEntries(["mon","tue","wed","thu","fri","sat","sun"].map(d=>[d,{open:"12:00",close:"23:00",closed:false}])),reservation_duration_minutes:90,reservation_buffer_minutes:15,reservation_days_ahead:30,plan_id:"test-plan"};
const item={id:"test-item",category_id:"test-category",name:"Chicken Biryani",description:"Fragrant basmati rice with aromatic spices.",image_url:"/food/biryani.jpg",price:"600.00",available:true,published:true,featured:true,variant_required:true,variants:[{id:"regular",name:"Regular",price_delta:"0.00"},{id:"large",name:"Large",price_delta:"200.00"}],modifiers:[{id:"raita",name:"Raita",price_delta:"80.00"}]};
const category={id:"test-category",name:"Signature dishes",position:0,published:true,items:[item]};
const plan={id:"test-plan",name:"Starter",description:"A clear set of restaurant entitlements.",max_menu_items:30,active:true};
const page=items=>({items,total:items.length,page:1,page_size:20});
const user={id:"test-owner",email:"owner@example.com",full_name:"Demo Owner",role:"owner",restaurant_id:restaurant.id,email_verified:true};
const quote=body=>{const items=body.items.map(l=>{const unit=Number(item.price)+(l.variant_id==="large"?200:0)+(l.modifier_ids.includes("raita")?80:0);return {menu_item_id:item.id,name:item.name,quantity:l.quantity,variant_name:l.variant_id==="large"?"Large":"Regular",modifier_names:l.modifier_ids.includes("raita")?["Raita"]:[],unit_price:unit.toFixed(2),line_total:(unit*l.quantity).toFixed(2),notes:l.notes};});const subtotal=items.reduce((sum,i)=>sum+Number(i.line_total),0);const delivery=body.fulfilment==="delivery"?150:0;return {items,subtotal:subtotal.toFixed(2),delivery_fee:delivery.toFixed(2),tax:"0.00",total:(subtotal+delivery).toFixed(2),currency:"PKR",quote_token:`fixture-signed-quote-${item.price}`};};
const orders=new Map();
const dashboard={orders_today:0,gross_sales:"0.00",net_sales:"0.00",pending_orders:0,average_order_value:"0.00",upcoming_reservations:0,recent_orders:[],top_items:[],definitions:{gross_sales:"Completed and cash-paid orders only.",orders_today:"All orders created today within the selected period."}};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,"http://127.0.0.1");const path=url.pathname.replace(/^\/api\/v1/,"");
  let raw="";for await(const chunk of req)raw+=chunk;
  const body=raw?JSON.parse(raw):{};
  const respond=(data,status=200)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(data));};
  if(path==="/health")return respond({ok:true});
  if(path==="/__test/reset"){item.price="600.00";orders.clear();return respond({ok:true});}
  if(path==="/__test/price"){item.price="650.00";return respond({ok:true});}
  if(path==="/public/restaurants")return respond(page([restaurant]));
  if(path==="/public/restaurants/saffron-table")return respond(restaurant);
  if(path==="/public/restaurants/saffron-table/menu")return respond({categories:[category]});
  if(path==="/public/restaurants/saffron-table/quote")return respond(quote(body));
  if(path==="/public/restaurants/saffron-table/orders"){
    const key=req.headers["idempotency-key"];
    if(orders.has(key))return respond(orders.get(key));
    if(body.quote_token!==`fixture-signed-quote-${item.price}`)return respond({detail:"Cart or prices changed. Request and explicitly confirm a new quote.",code:"quote_changed"},409);
    if(body.payment_status||body.payment_method)return respond({detail:"No payment state is accepted at public checkout."},422);
    const order={...quote(body),id:"test-order",reference:"ZQ-TEST",tracking_token:"test-private-token",status:"PENDING",payment_status:"unpaid",payment_method:"cash",fulfilment:body.fulfilment,created_at:new Date().toISOString(),history:[{status:"PENDING",created_at:new Date().toISOString(),reason:""}]};
    orders.set(key,order);return respond(order,201);
  }
  if(path==="/public/orders/test-private-token")return respond([...orders.values()][0]||{...quote({items:[],fulfilment:"pickup"}),id:"test-order",reference:"ZQ-TEST",status:"PENDING",payment_status:"unpaid",payment_method:"cash",fulfilment:"pickup",created_at:new Date().toISOString(),history:[]});
  if(path==="/public/plans"||path==="/platform/plans")return respond({items:[plan]});
  if(path==="/auth/login")return respond({access_token:body.email==="admin@example.com"?"test-admin":"test-owner",token_type:"bearer",user:body.email==="admin@example.com"?{...user,role:"platform_admin",restaurant_id:null}:user});
  if(path==="/auth/me")return req.headers.authorization?respond(req.headers.authorization.includes("test-admin")?{...user,role:"platform_admin",restaurant_id:null}:user):respond({detail:"Sign in required"},401);
  if(path==="/auth/logout")return respond({message:"Session revoked."});
  if(path==="/auth/register")return respond({message:"Registration pending email verification. No email has been sent.",verification_required:true,email_delivery_status:"provider_not_configured"});
  if(path==="/auth/verify-email")return respond({message:"Email verified. You can now sign in."});
  if(path==="/restaurant")return respond(restaurant);
  if(path==="/menu/categories")return respond({items:[category]});
  if(path==="/orders"||path==="/reservations"||path==="/notifications")return respond(page([]));
  if(path==="/tables")return respond({items:[]});
  if(path==="/reports/dashboard"||path==="/reports/sales")return respond(dashboard);
  if(path==="/platform/overview")return respond({total_tenants:1,active_tenants:1,suspended_tenants:0,published_restaurants:1,total_orders:0});
  if(path==="/platform/tenants")return respond(page([restaurant]));
  if(path==="/public/restaurants/saffron-table/availability")return respond({slots:[{starts_at:`${url.searchParams.get("date")}T14:00:00+05:00`,ends_at:`${url.searchParams.get("date")}T15:30:00+05:00`}]});
  return respond({detail:"Fixture endpoint not found."},404);
});
server.listen(18117,"127.0.0.1");
