export default function DashboardLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar skeleton */}
      <div className="h-14 border-b border-gray-100 dark:border-gray-700 px-6 flex items-center">
        <div className="h-5 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5 max-w-6xl mx-auto w-full">
        {/* Balance card skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="h-4 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-4" />
          <div className="space-y-2 mb-4">
            <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse w-48" />
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse w-64" />
          </div>
          <div className="h-[120px] bg-gray-50 dark:bg-gray-700/50 rounded-xl animate-pulse" />
        </div>

        {/* Market stats skeleton */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-16" />
              <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mt-2 w-24" />
              <div className="h-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse mt-3" />
            </div>
          ))}
        </div>

        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm h-80 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
