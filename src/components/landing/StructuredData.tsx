import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  featureList: [
    "Non-custodial STX to sBTC DCA",
    "sBTC to USDCx DCA",
    "Stacks portfolio tracking",
    "Bitflow token swaps",
    "Price and execution alerts",
  ],
};

export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
