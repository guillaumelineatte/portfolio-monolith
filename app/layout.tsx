import type { Metadata } from "next";
import { inter, newsreader } from "./fonts";
import { CanvasRoot } from "@/components/CanvasRoot";
import { Header } from "@/components/Header";
import { Loader } from "@/components/Loader";
import { LiveRegion } from "@/components/LiveRegion";
import { RouteTransitionProvider } from "@/components/RouteTransitionProvider";
import { site } from "@/content/site";
import "./globals.css";

// TODO: real domain (also used in app/sitemap.ts)
const BASE_URL = "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${site.name} — ${site.role}`,
    template: `%s — ${site.name}`,
  },
  description: `${site.name}, independent interactive developer. Selected work and contact.`,
  openGraph: {
    type: "website",
    siteName: site.name,
    // TODO: static screenshot of the scene, the WebGL part can't be generated dynamically
    images: ["/og/default.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`is-loading ${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <body>
        <CanvasRoot />
        <Loader />
        <Header />
        <LiveRegion />
        <RouteTransitionProvider>{children}</RouteTransitionProvider>
      </body>
    </html>
  );
}
