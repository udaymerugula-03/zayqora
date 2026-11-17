import test from "node:test";
import assert from "node:assert/strict";
import {canOrder,isDemo,isPublicRestaurant,safeImageUrl,websiteSettings,websiteSettingsSchema} from "../src/lib/website.ts";

test("legacy website data receives safe independent defaults",()=>{
  const first=websiteSettings({});const second=websiteSettings({});
  assert.equal(first.theme,"navy");assert.equal(first.reservations_enabled,true);
  assert.deepEqual(first.homepage_sections,["featured","about","hours"]);
  first.gallery.push({image_url:"/food/biryani.jpg",alt:"Biryani"});
  assert.equal(second.gallery.length,0);
});
test("demo classification uses explicit server flags before legacy fixture slugs",()=>{
  assert.equal(isDemo({slug:"saffron-table"}),true);
  assert.equal(isDemo({slug:"garden-cafe"}),true);
  assert.equal(isDemo({slug:"saffron-table",is_demo:false}),false);
  assert.equal(isDemo({slug:"another-tenant",is_demo:true}),true);
  assert.equal(isDemo({slug:"real-restaurant"}),false);
});
test("ordering needs at least one enabled fulfilment service",()=>{
  assert.equal(canOrder({allow_pickup:false,allow_delivery:false}),false);
  assert.equal(canOrder({allow_pickup:true,allow_delivery:false}),true);
  assert.equal(canOrder({allow_pickup:false,allow_delivery:true}),true);
});
test("public visibility requires a real active published restaurant",()=>{
  const restaurant={slug:"real-restaurant",is_demo:false,published:true,status:"active"};
  assert.equal(isPublicRestaurant(restaurant),true);
  assert.equal(isPublicRestaurant({...restaurant,is_demo:true}),false);
  assert.equal(isPublicRestaurant({...restaurant,published:false}),false);
  assert.equal(isPublicRestaurant({...restaurant,status:"suspended"}),false);
});
test("gallery URLs reject unsafe protocols and non-media relative paths",()=>{
  for(const image of ["/food/biryani.jpg","/media/photo.webp","https://images.example.com/photo.jpg"])assert.equal(safeImageUrl(image),true,image);
  for(const image of ["javascript:alert(1)","http://images.example.com/a.jpg","//example.com/a.jpg","/admin/secret","/media/../private","https://user:password@example.com/a.jpg"])assert.equal(safeImageUrl(image),false,image);
});
test("full website settings preserve disabled sections and ordering",()=>{
  const settings={...websiteSettings({}),homepage_sections:["hours","gallery"]};
  assert.deepEqual(websiteSettingsSchema.parse(settings).homepage_sections,["hours","gallery"]);
});
test("website settings validate unique sections, gallery descriptions and FAQs",()=>{
  const defaults=websiteSettings({});
  assert.equal(websiteSettingsSchema.safeParse({...defaults,homepage_sections:["about","about"]}).success,false);
  assert.equal(websiteSettingsSchema.safeParse({...defaults,gallery:[{image_url:"/food/hero.jpg",alt:" "}]}).success,false);
  assert.equal(websiteSettingsSchema.safeParse({...defaults,faqs:[{question:"Where?",answer:""}]}).success,false);
  assert.equal(websiteSettingsSchema.safeParse({...defaults,seo_description:"a".repeat(321)}).success,false);
  assert.equal(websiteSettingsSchema.safeParse({...defaults,theme:"arbitrary"}).success,false);
});
