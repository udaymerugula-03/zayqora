import Link from "next/link";
import {Header, Footer} from "@/components/ui";
export default function NotFound() { return <><Header/><main id="main" className="container section"><h1>Page not available</h1><p>This restaurant or page may not be published, or its address has changed.</p><Link className="button" href="/">Back to ZAYQORA</Link></main><Footer/></>; }
