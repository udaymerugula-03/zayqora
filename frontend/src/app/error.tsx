"use client";
import {Notice,Header,Footer} from "@/components/ui";
export default function ErrorPage({reset}: {reset:()=>void}) { return <><Header/><main id="main" className="container section"><h1>Something went wrong</h1><Notice error>We couldn&apos;t load this page. The restaurant service may be unavailable. No action has been assumed successful.</Notice><button onClick={reset}>Try again</button></main><Footer/></>; }
