export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded-lg bg-slate-200" />
          <div className="h-7 w-48 rounded-lg bg-slate-200" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-slate-200" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-8 w-16 rounded-lg bg-slate-200" />
                <div className="h-3 w-20 rounded bg-slate-100" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
            </div>
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="h-4 w-32 rounded bg-slate-200" />
            </div>
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-200 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-slate-200" />
                    <div className="h-3 w-20 rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-16 rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
