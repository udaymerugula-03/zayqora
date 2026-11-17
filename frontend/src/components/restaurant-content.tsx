import Link from "next/link";
import type {Category, Restaurant} from "@/lib/types";
import {money} from "@/lib/commerce";
import {canOrder, isDemo, websiteSettings} from "@/lib/website";

export function RestaurantHours({restaurant:r}: {restaurant:Restaurant}) {
  return <section className="restaurant-hours"><h2>Opening hours</h2><p className="muted">All times {r.timezone}</p>{["mon","tue","wed","thu","fri","sat","sun"].map(day=>{
    const hours=r.opening_hours?.[day];
    return <div className="hours-row" key={day}><strong>{day}</strong><span>{!hours?"Not published":hours.closed?"Closed":`${hours.open} – ${hours.close}`}</span></div>;
  })}</section>;
}

export function RestaurantGallery({restaurant:r}: {restaurant:Restaurant}) {
  return <div className="restaurant-gallery">{websiteSettings(r).gallery.map((image,index)=><figure key={`${index}-${image.image_url}`}><img src={image.image_url} alt={image.alt} loading="lazy"/><figcaption>{image.alt}</figcaption></figure>)}</div>;
}

export function RestaurantHomeContent({restaurant:r,categories=[],preview=false}:{restaurant:Restaurant;categories?:Category[];preview?:boolean}) {
  const settings=websiteSettings(r);const base=`/r/${r.slug}`;
  const publishedItems=categories.filter(category=>category.published).flatMap(category=>category.items).filter(item=>item.published&&item.available);
  const featured=publishedItems.filter(item=>item.featured);
  const items=(featured.length?featured:publishedItems).slice(0,3);
  return <>
    {isDemo(r)&&<div className="container"><p className="notice">Demonstration restaurant. Restaurant details and menu are fictional; orders and reservations do not provide real food or dining.</p></div>}
    <section className="restaurant-editorial container">
      <div className="restaurant-introduction"><span className="eyebrow">{[r.cuisine,r.city].filter(Boolean).join(" · ")}</span>{preview?<h3 className="preview-hero-heading">{r.name}</h3>:<h1>{r.name}</h1>}{r.tagline&&<p className="restaurant-tagline">{r.tagline}</p>}<p className="preserve-lines">{r.description}</p>
        {!preview&&<div className="actions"><Link className="button" href={`${base}/menu`}>{canOrder(r)?"Order online":"Explore the menu"} ↗</Link>{settings.reservations_enabled&&<Link className="text-link" href={`${base}/reservations`}>Reserve a table →</Link>}</div>}
        <div className="restaurant-service-note"><span>{[r.allow_pickup&&"Pickup",r.allow_delivery&&"Delivery"].filter(Boolean).join(" & ")||"Online ordering unavailable"} · Cash only · Prices in {r.currency}</span></div>
      </div>
      <div className="restaurant-editorial-images"><img className="restaurant-interior" src={r.hero_image_url||"/food/hero.jpg"} alt={r.hero_image_url?`${r.name} cover photograph`:"Illustrative restaurant photograph"}/>{!r.hero_image_url&&<span className="fine image-disclaimer">Illustrative photograph</span>}<span className="vertical-caption">GOOD FOOD. BEAUTIFULLY CONNECTED.</span></div>
    </section>
    {settings.homepage_sections.map(section=>{
      if(section==="featured")return <section key={section} className="container section"><div className="section-heading"><div><span className="eyebrow">From the current menu</span><h2>A taste of <em>{r.name}.</em></h2></div><p>Current prices and availability are checked at checkout.</p></div>{items.length?<div className="food-editorial">{items.map(item=><article className="published-menu-feature" key={item.id}>{item.image_url&&<img src={item.image_url} alt={item.name} loading="lazy"/>}<div><h3>{item.name}</h3><p>{item.description}</p><strong>{money(item.price)}</strong></div></article>)}</div>:<p className="muted">{preview?"Published menu items appear here after you add them to your menu.":"No available menu items have been published."}</p>}{!preview&&<Link className="text-link" href={`${base}/menu`}>View the full menu →</Link>}</section>;
      if(section==="about")return <section key={section} className="container section"><span className="eyebrow">Our story</span><h2>{r.tagline||`About ${r.name}`}</h2><p className="preserve-lines restaurant-about-copy">{settings.about_text||r.description||"The restaurant has not added its story yet."}</p>{!preview&&<Link className="text-link" href={`${base}/about`}>More about us →</Link>}</section>;
      if(section==="gallery"&&settings.gallery_enabled&&settings.gallery.length)return <section key={section} className="container section"><h2>Gallery</h2><RestaurantGallery restaurant={r}/></section>;
      if(section==="hours")return <section key={section} className="container section restaurant-hours-grid"><RestaurantHours restaurant={r}/><div><h2>Find us</h2><address>{r.address||"Address not yet published."}<br/>{r.city}</address>{r.phone&&<p><a href={`tel:${r.phone}`}>{r.phone}</a></p>}{r.email&&<p><a href={`mailto:${r.email}`}>{r.email}</a></p>}{!preview&&<Link className="text-link" href={`${base}/contact`}>Contact the restaurant →</Link>}</div></section>;
      return null;
    })}
    {!preview&&settings.reservations_enabled&&<section className="container reservation-callout"><span className="eyebrow">Make room for good company</span><h2>A table for<br/><em>your next occasion.</em></h2><p>Check available slots and request a table. All times {r.timezone}.</p><Link className="button" href={`${base}/reservations`}>Find a table ↗</Link><span className="fine">Requests are reviewed by the restaurant.{isDemo(r)?" Demo reservations do not provide real dining.":""}</span></section>}
  </>;
}
