import type { Metadata } from "next";
import { AboutView } from "@/components/AboutView";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "About",
  description: site.bio,
};

export default function AboutPage() {
  return <AboutView />;
}
