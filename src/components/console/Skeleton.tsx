export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden />
}

export function SkeletonStat() {
  return (
    <div className="glass-premium p-6 rounded-2xl flex flex-col justify-between min-h-[148px]">
      <div className="flex justify-between items-start">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-9 w-9 rounded-xl" />
      </div>
      <SkeletonBlock className="h-8 w-32 mt-5" />
    </div>
  )
}

export function SkeletonChart({ height = 'h-52' }: { height?: string }) {
  return (
    <div className={`w-full ${height} rounded-xl overflow-hidden`}>
      <SkeletonBlock className="w-full h-full rounded-xl" />
    </div>
  )
}

export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-6 px-6 py-5">
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-4 ${i === 0 ? 'flex-1' : 'w-20'}`} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 3, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-white/[0.04]">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-premium p-6 rounded-2xl flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-9 w-9 rounded-xl shrink-0" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-4/5" />
      <SkeletonBlock className="h-9 w-full rounded-lg mt-2" />
    </div>
  )
}

export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
