import type { Metadata } from "next";
import HomePageClient from "@/components/landing/HomePageClient";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Non-Custodial sBTC DCA on Stacks",
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: "StacksPort - Non-Custodial sBTC DCA on Stacks",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "StacksPort product overview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StacksPort - Non-Custodial sBTC DCA on Stacks",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function Home() {
  return <HomePageClient />;
}
