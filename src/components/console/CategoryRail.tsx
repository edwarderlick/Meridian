export interface Category {
  label: string
  icon: string
}

interface CategoryRailProps {
  categories: Category[]
  active?: string
  onSelect?: (label: string) => void
  title?: string
}

export default function CategoryRail({ categories, active, onSelect, title = 'Categories' }: CategoryRailProps) {
  return (
    <nav className="col-span-12 md:col-span-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
      <h4 className="hidden md:block font-label-caps text-label-caps text-on-surface-variant/40 mb-2">{title}</h4>
      {categories.map((cat) => (
        <button
          key={cat.label}
          type="button"
          disabled={!onSelect}
          aria-pressed={onSelect ? active === cat.label : undefined}
          onClick={() => onSelect?.(cat.label)}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-premium disabled:cursor-not-allowed shrink-0 ${
            active === cat.label
              ? 'bg-primary/10 border-primary/25 text-primary'
              : `bg-white/5 border-white/10 text-on-surface-variant/60${onSelect ? ' hover:bg-white/[0.07] hover:text-on-surface' : ''}`
          }`}
        >
          <span className="material-symbols-outlined">{cat.icon}</span>
          <span className="font-mono-data text-sm whitespace-nowrap">{cat.label}</span>
        </button>
      ))}
    </nav>
  )
}
