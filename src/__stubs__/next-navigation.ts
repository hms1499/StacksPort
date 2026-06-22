// Stub for next/navigation — used only in vitest (node environment).
// Provides no-op exports so modules that transitively import next/navigation
// can be loaded without a full Next.js runtime.
export const useRouter = () => ({});
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const redirect = () => {};
export const notFound = () => {};
export const useSelectedLayoutSegment = () => null;
export const useSelectedLayoutSegments = () => [];
