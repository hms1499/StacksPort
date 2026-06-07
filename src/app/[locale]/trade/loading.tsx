export default function TradeLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-14 border-b border-gray-100 dark:border-gray-700 px-6 flex items-center">
        <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="flex-1 p-4 md:p-6 max-w-lg mx-auto w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="h-5 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-24 bg-gray-50 dark:bg-gray-700/50 rounded-xl animate-pulse" />
          <div className="h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse mx-auto" />
          <div className="h-24 bg-gray-50 dark:bg-gray-700/50 rounded-xl animate-pulse" />
          <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
