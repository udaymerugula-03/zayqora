import type {Metadata} from "next";
import {Providers} from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {title:{default:"ZAYQORA — Good food. Beautifully connected.",template:"%s | ZAYQORA"},description:"Discover restaurants in Pakistan. Order for cash delivery or pickup, reserve a table, and connect with good food."};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) { return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Providers>{children}</Providers></body></html>; }
