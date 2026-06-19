import { cn } from "@/lib/utils";

// Inline SVG flags for the supported locales. Inline (not emoji) so they render
// identically on every OS/browser — Windows renders flag emoji as letter pairs
// ("US", "VN"), which defeats the purpose. Simplified heraldry: recognizable at
// ~20px, not pixel-perfect. Decorative — callers label the option with the
// language name, so the wrapper is aria-hidden.
//
// Flag choices: en→US, vi→VN, zh→CN, ja→JP, ko→KR, es→ES (Spain), pt→BR (the
// catalog is Brazilian Portuguese). viewBox is a 3:2 field (21×14).

const US_STRIPE = 14 / 13;
const usWhiteStripes = [1, 3, 5, 7, 9, 11].map((i) => i * US_STRIPE);
const usStars: Array<[number, number]> = [];
for (const y of [1.6, 3.4, 5.2]) {
  for (const x of [1.6, 3.4, 5.2, 7.0]) usStars.push([x, y]);
}

function flagBody(locale: string) {
  switch (locale) {
    case "vi":
      return (
        <>
          <rect width="21" height="14" fill="#DA251D" />
          <Star cx={10.5} cy={7} r={4.6} fill="#FFFF00" />
        </>
      );
    case "zh":
      return (
        <>
          <rect width="21" height="14" fill="#DE2910" />
          <Star cx={4.2} cy={3.6} r={2.5} fill="#FFDE00" />
          <Star cx={8.4} cy={1.6} r={0.9} fill="#FFDE00" />
          <Star cx={9.8} cy={3.4} r={0.9} fill="#FFDE00" />
          <Star cx={9.8} cy={5.6} r={0.9} fill="#FFDE00" />
          <Star cx={8.4} cy={7.2} r={0.9} fill="#FFDE00" />
        </>
      );
    case "ja":
      return (
        <>
          <rect width="21" height="14" fill="#FFFFFF" />
          <circle cx="10.5" cy="7" r="4.1" fill="#BC002D" />
        </>
      );
    case "ko":
      return (
        <>
          <rect width="21" height="14" fill="#FFFFFF" />
          <circle cx="10.5" cy="7" r="4" fill="#0047A0" />
          <path
            d="M10.5 3 A2 2 0 0 1 10.5 7 A2 2 0 0 0 10.5 11 A4 4 0 0 1 10.5 3 Z"
            fill="#CD2E3A"
          />
        </>
      );
    case "es":
      return (
        <>
          <rect width="21" height="14" fill="#C60B1E" />
          <rect y="3.5" width="21" height="7" fill="#FFC400" />
        </>
      );
    case "pt":
      return (
        <>
          <rect width="21" height="14" fill="#009B3A" />
          <path d="M10.5 1.5 L19.5 7 L10.5 12.5 L1.5 7 Z" fill="#FEDF00" />
          <circle cx="10.5" cy="7" r="3" fill="#002776" />
        </>
      );
    case "en":
    default:
      return (
        <>
          <rect width="21" height="14" fill="#B22234" />
          {usWhiteStripes.map((y) => (
            <rect key={y} y={y} width="21" height={US_STRIPE} fill="#FFFFFF" />
          ))}
          <rect width="9" height={US_STRIPE * 7} fill="#3C3B6E" />
          {usStars.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.45" fill="#FFFFFF" />
          ))}
        </>
      );
  }
}

function Star({
  cx,
  cy,
  r,
  fill,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}

export default function Flag({
  locale,
  className,
}: {
  locale: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10",
        className,
      )}
    >
      <svg
        viewBox="0 0 21 14"
        className="size-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {flagBody(locale)}
      </svg>
    </span>
  );
}
