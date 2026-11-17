import Link from "next/link";
import {Header, Footer} from "@/components/ui";
import {Discovery} from "@/components/discovery";
export default function Home() {
  return <><Header/><main id="main">
    <section className="editorial-hero container">
      <div className="editorial-copy">
        <span className="eyebrow">The art of eating well · Pakistan</span>
        <h1>For the love<br/>of <em>good food.</em></h1>
        <p>Extraordinary flavours. Familiar faces. A table worth gathering around. Find your next restaurant moment with ZAYQORA.</p>
        <div className="actions"><a href="#discover" className="button">Discover restaurants <span aria-hidden="true">↗</span></a><Link href="/r/saffron-table" className="text-link">Visit our demo restaurant →</Link></div>
        <div className="hero-note"><span className="seal" aria-hidden="true">Z</span><p>A little local. A little personal.<br/><strong>Good food. Beautifully connected.</strong></p></div>
      </div>
      <div className="editorial-collage">
        <figure className="collage-main"><img src="/food/biryani-hero.jpg" alt="A platter of fragrant biryani garnished with lime"/><figcaption>Something worth sharing.</figcaption></figure>
        <figure className="collage-small"><img src="/food/biryani.jpg" alt="A generous serving of fragrant biryani"/><figcaption>Rooted in flavour.</figcaption></figure>
        <div className="collage-caption"><span className="eyebrow">Your next gathering</span><strong>Starts with an appetite.</strong><span>Discover · Order · Reserve</span></div>
        <span className="collage-stamp" aria-hidden="true">GOOD FOOD<br/>GOOD COMPANY<br/>✦</span>
      </div>
    </section>
    <div className="editorial-ribbon"><div className="container"><span>Thoughtfully connected</span><span>Local restaurants</span><i>✦</i><span>Cash on delivery &amp; pickup</span><i>✦</i><span>Table reservations</span><i>✦</i><span>Always PKR</span></div></div>
    <section id="discover" className="container section discovery-section">
      <div className="section-heading"><div><span className="eyebrow">The restaurant collection</span><h2>A place for <em>every appetite.</em></h2></div><p>Explore published restaurants, their menus<br/>and the stories behind the food.</p></div>
      <Discovery/>
    </section>
    <section className="gather-section container">
      <div className="gather-photo"><img src="/food/hero.jpg" alt="A thoughtfully arranged restaurant dining room"/><span className="photo-caption">Make room for a little togetherness.</span></div>
      <div className="gather-copy"><span className="eyebrow">Less between you and your meal</span><h2>A good evening.<br/><em>Simply arranged.</em></h2><div className="steps">
        <article><span>01</span><div><h3>Find your kind of place</h3><p>Browse real restaurant information and current menus.</p></div></article>
        <article><span>02</span><div><h3>Choose your moment</h3><p>Customise a cash order, or request an available table.</p></div></article>
        <article><span>03</span><div><h3>Leave room for enjoyment</h3><p>Review your server-confirmed total and follow restaurant updates.</p></div></article>
      </div><Link href="/r/saffron-table/menu" className="text-link">Experience the demo menu →</Link></div>
    </section>
    <section className="container section"><div className="owner-banner">
      <div><span className="eyebrow">For the people behind the plates</span><h2>Hospitality is your craft.<br/><em>Connection is ours.</em></h2><p>A beautiful restaurant site. A considered owner workspace.<br/>Menus, cash orders and reservations, brought together.</p><Link className="button" href="/pricing">Explore restaurant plans ↗</Link></div>
      <div className="owner-banner-aside"><span>THE RESTAURANT WORKSPACE</span><div><b>01</b> Your menu, beautifully presented</div><div><b>02</b> Every order, thoughtfully organised</div><div><b>03</b> More time for your guests</div><small>Release 1 · Owner-operated · Cash only</small></div>
    </div></section>
  </main><Footer/></>;
}
