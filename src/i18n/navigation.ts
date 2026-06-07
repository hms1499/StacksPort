import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next.js navigation APIs.
// Use these everywhere instead of next/link and next/navigation so the
// active locale is preserved across client navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
