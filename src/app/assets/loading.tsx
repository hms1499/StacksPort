export default function AssetsLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-14 border-b border-gray-100 dark:border-gray-700 px-6 flex items-center">
        <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-6xl mx-auto w-full">
        {/* Portfolio summary skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="h-4 w-32 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-3" />
          <div className="h-8 w-40 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-56 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        {/* Holdings grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm h-64 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
