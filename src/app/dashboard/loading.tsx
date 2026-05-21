export default function DashboardLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar skeleton */}
      <div className="h-14 border-b border-gray-100 dark:border-gray-700 px-6 flex items-center">
        <div className="h-5 w-24 rounded skeleton" />
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5 max-w-6xl mx-auto w-full">
        {/* Balance card skeleton */}
        <div className="glass-card rounded-2xl p-5 shadow-sm">
          <div className="h-4 w-16 rounded skeleton mb-4" />
          <div className="space-y-2 mb-4">
            <div className="h-10 w-48 rounded-lg skeleton" />
            <div className="h-4 w-64 rounded-lg skeleton" />
          </div>
          <div className="h-[120px] rounded-xl skeleton" />
        </div>

        {/* Market stats skeleton */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 shadow-sm">
              <div className="h-3 w-16 rounded skeleton" />
              <div className="h-6 w-24 rounded mt-2 skeleton" />
              <div className="h-12 rounded-lg mt-3 skeleton" />
            </div>
          ))}
        </div>

        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl shadow-sm h-80 skeleton" />
          ))}
        </div>
      </div>
    </div>
  );
}
