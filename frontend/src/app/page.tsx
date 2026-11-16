import Link from "next/link";
import {Header, Footer} from "@/components/ui";
import {Discovery} from "@/components/discovery";
export default function Home() {
  return <><Header/><main id="main">
    <section className="platform-hero"><div className="container hero-grid">
      <div className="hero-copy">
        <span className="eyebrow"><span className="gold-dot"/> A little discovery. A lot of flavour.</span>
        <h1>Your next<br/>great meal<br/><em>starts here.</em></h1>
        <p>From a familiar favourite to something new.<br className="desktop"/> Discover local restaurants, order your way,<br className="desktop"/> and make a little room for good food.</p>
        <div className="actions"><a href="#discover" className="button">Find your flavour <span>↗</span></a><Link href="/r/saffron-table" className="text-link">Explore the demo →</Link></div>
        <div className="hero-assurance"><span>✦ Local restaurants</span><span>✦ Cash on delivery / pickup</span></div>
      </div>
      <div className="hero-art">
        <div className="food-circle"/>
        <img className="hero-photo" src="/food/biryani.jpg" alt="Fragrant biryani with fresh herbs and warming spices"/>
        <span className="food-sticker">Made with love.<br/><strong>Shared with joy.</strong></span>
        <div className="hero-caption"><span className="mini-icon">⌑</span><div><strong>Good food, closer to you.</strong><small>Explore Saffron Table · Demo restaurant</small></div><span>↗</span></div>
        <span className="hero-spark">✦</span>
      </div>
    </div></section>
    <div className="flavour-strip"><div className="container"><span>FIND YOUR NEW FAVOURITE</span><span>Pakistani classics</span><b>✦</b><span>Comfort food</span><b>✦</b><span>Something sweet</span><b>✦</b><span>Good company</span></div></div>
    <section id="discover" className="container section">
      <div className="section-heading"><div><span className="eyebrow">Pull up a chair</span><h2>Good places. <em>Great plates.</em></h2></div><p>Browse currently published restaurants.<br/>Restaurant details come directly from their menus.</p></div>
      <Discovery/>
    </section>
    <section className="soft-section"><div className="container split">
      <div><span className="eyebrow">Simple, from the first bite</span><h2>A good meal.<br/>Without the extra steps.</h2><p>Find a restaurant, build your order, and pay in cash at pickup or delivery. Prefer a table? Request an available slot directly.</p><Link href="/r/saffron-table/menu" className="button">Try the demo menu ↗</Link></div>
      <div className="steps">
        <article><span>01</span><div><h3>Find your flavour</h3><p>Explore the restaurant and its current menu.</p></div></article>
        <article><span>02</span><div><h3>Make it yours</h3><p>Choose your favourites, customise, and review a live quote.</p></div></article>
        <article><span>03</span><div><h3>Enjoy the moment</h3><p>Pay in cash. Follow order updates using your private tracking link.</p></div></article>
      </div>
    </div></section>
    <section className="container section"><div className="owner-banner">
      <div><span className="eyebrow">For the people behind the plates</span><h2>Your food deserves<br/>a beautiful home online.</h2><p>A restaurant site, cash orders, reservations and one clear workspace.<br/>Built for owner-operated restaurants. Not a complicated POS.</p><Link className="button" href="/pricing">Meet your new workspace ↗</Link></div>
      <div className="banner-mark" aria-hidden="true">Z<span>✦</span></div>
    </div></section>
  </main><Footer/></>;
}
