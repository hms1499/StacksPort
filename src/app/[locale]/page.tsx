import type { Metadata } from "next";
import HomePageClient from "@/components/landing/HomePageClient";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Non-Custodial sBTC DCA on Stacks",
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  // og:image and twitter:image are emitted automatically from the
  // app/opengraph-image.tsx file convention — declaring them here too would
  // produce duplicate image tags.
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: "StacksPort - Non-Custodial sBTC DCA on Stacks",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "StacksPort - Non-Custodial sBTC DCA on Stacks",
    description: SITE_DESCRIPTION,
  },
};

export default function Home() {
  return <HomePageClient />;
}
