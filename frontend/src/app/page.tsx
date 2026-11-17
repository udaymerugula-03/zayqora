import Link from "next/link";
import {Header, Footer} from "@/components/ui";
import {Discovery} from "@/components/discovery";
export default function Home() {
  return <><Header/><main id="main">
    <section className="editorial-hero platform-hero container">
      <div className="editorial-copy">
        <span className="eyebrow">Restaurant websites &amp; operations · Pakistan</span>
        <h1>Your food.<br/><em>Your website.</em></h1>
        <p>Create your restaurant website and manage your menu, cash orders and table reservations from one ZAYQORA workspace. Your restaurant, your content, with prices in PKR.</p>
        <div className="actions"><Link href="/register" className="button">Create your restaurant website <span aria-hidden="true">↗</span></Link></div>
        <div className="hero-note"><span className="seal" aria-hidden="true">Z</span><p>Your public website. Your owner workspace.<br/><strong>One connected restaurant platform.</strong></p></div>
      </div>
      <div className="editorial-collage">
        <figure className="collage-main"><img src="/food/biryani-hero.jpg" alt="A platter of fragrant biryani garnished with lime"/><figcaption>Something worth sharing.</figcaption></figure>
        <figure className="collage-small"><img src="/food/biryani.jpg" alt="A generous serving of fragrant biryani"/><figcaption>Rooted in flavour.</figcaption></figure>
        <div className="collage-caption"><span className="eyebrow">Built around your restaurant</span><strong>From your menu to their table.</strong><span>Website · Orders · Reservations</span></div>
        <span className="collage-stamp" aria-hidden="true">GOOD FOOD<br/>GOOD COMPANY<br/>✦</span>
      </div>
    </section>
    <div className="editorial-ribbon"><div className="container"><span>One connected workspace</span><span>Your restaurant website</span><i>✦</i><span>Cash delivery &amp; pickup orders</span><i>✦</i><span>Table reservations</span><i>✦</i><span>Pakistan · PKR</span></div></div>
    <section className="gather-section container section">
      <div className="gather-photo"><img src="/food/hero.jpg" alt="A thoughtfully arranged restaurant dining room"/><span className="photo-caption">Make room for a little togetherness.</span></div>
      <div className="gather-copy"><span className="eyebrow">From registration to daily service</span><h2>Your restaurant.<br/><em>Ready for its next chapter.</em></h2><div className="steps">
        <article><span>01</span><div><h3>Create and verify your owner account</h3><p>Register your restaurant and verify your email before opening your workspace.</p></div></article>
        <article><span>02</span><div><h3>Make the website your own</h3><p>Add your branding, menu, hours and contact details. Review your website on desktop, tablet and mobile.</p></div></article>
        <article><span>03</span><div><h3>Publish and manage daily service</h3><p>Publish when ready, then manage cash orders, reservation requests and contact enquiries.</p></div></article>
      </div><Link href="/pricing" className="text-link">Compare restaurant plans →</Link></div>
    </section>
    <section className="container section"><div className="owner-banner">
      <div><span className="eyebrow">For the people behind the plates</span><h2>Hospitality is your craft.<br/><em>Connection is ours.</em></h2><p>A beautiful restaurant site. A considered owner workspace.<br/>Menus, cash orders and reservations, brought together.</p><Link className="button" href="/pricing">Explore restaurant plans ↗</Link></div>
      <div className="owner-banner-aside"><span>THE ZAYQORA WORKSPACE</span><div><b>01</b> Website builder &amp; menu management</div><div><b>02</b> Cash orders &amp; kitchen order board</div><div><b>03</b> Reservations, enquiries &amp; sales reports</div><small>Owner-operated · Cash pickup &amp; delivery</small></div>
    </div></section>
    <section id="discover" className="container section discovery-section">
      <div className="section-heading"><div><span className="eyebrow">For customers</span><h2>Find a restaurant.<br/><em>Visit its website.</em></h2></div><p>Browse published restaurant websites.<br/>Order or request a table directly on the restaurant&apos;s site.</p></div>
      <Discovery/>
    </section>
  </main><Footer/></>;
}
