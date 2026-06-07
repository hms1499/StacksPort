import { redirect } from "next/navigation";

// Unmatched top-level paths fall through to the default locale, whose
// [locale]/not-found.tsx renders the styled 404 inside the app layout.
export default function RootNotFound() {
  redirect("/");
}
