import type {Metadata} from "next";
import {Providers} from "@/components/providers";
import "./globals.css";
import "./redesign.css";
import "./alignment.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-600.css";
export const metadata: Metadata = {title:{default:"ZAYQORA — Good food. Beautifully connected.",template:"%s | ZAYQORA"},description:"Discover restaurants in Pakistan. Order for cash delivery or pickup, reserve a table, and connect with good food."};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) { return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Providers>{children}</Providers></body></html>; }
