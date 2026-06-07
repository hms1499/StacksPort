import { Compass, Home } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5 p-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <Compass size={26} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Page not found
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
        style={{ backgroundColor: "var(--accent)" }}
      >
        <Home size={14} /> Back to dashboard
      </Link>
    </div>
  );
}
