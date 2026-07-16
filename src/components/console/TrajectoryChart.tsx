import { useRef, useState, type MouseEvent } from 'react'

type Accent = 'primary' | 'secondary' | 'tertiary'

const ACCENT: Record<Accent, { stroke: string; fill: string }> = {
  primary: { stroke: '#ffaaf6', fill: 'rgba(255,170,246,0.24)' },
  secondary: { stroke: '#d1bcff', fill: 'rgba(209,188,255,0.24)' },
  tertiary: { stroke: '#4cd6ff', fill: 'rgba(76,214,255,0.24)' },
}

export default function TrajectoryChart({
  accent = 'primary',
  labels = ['—', '—', '—', '—', '—'],
}: {
  accent?: Accent
  labels?: string[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const { stroke, fill } = ACCENT[accent]
  const gradientId = `trajectory-gradient-${accent}`

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    setHoverX(Math.min(Math.max(e.clientX - rect.left, 0), rect.width))
  }

  return (
    <div className="relative h-52 w-full" onMouseLeave={() => setHoverX(null)}>
      <svg
        ref={svgRef}
        className="w-full h-full overflow-visible"
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor={fill.replace('0.24', '0')} />
          </linearGradient>
        </defs>

        {[50, 100, 150].map((y) => (
          <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
        ))}

        <path d="M0,190 L1000,190 L1000,200 L0,200 Z" fill={`url(#${gradientId})`} />
        <line x1="0" x2="1000" y1="190" y2="190" stroke={stroke} strokeWidth="2" strokeOpacity="0.55" />

        {hoverX !== null && (
          <>
            <line
              className="fade-in"
              x1={(hoverX / (svgRef.current?.getBoundingClientRect().width || 1)) * 1000}
              x2={(hoverX / (svgRef.current?.getBoundingClientRect().width || 1)) * 1000}
              y1="0"
              y2="200"
              stroke="rgba(255,255,255,0.14)"
            />
            <circle
              className="fade-in"
              cx={(hoverX / (svgRef.current?.getBoundingClientRect().width || 1)) * 1000}
              cy="190"
              r="4"
              fill={stroke}
              stroke="rgba(19,19,20,0.9)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {hoverX !== null && (
        <div
          className="fade-in absolute top-2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg glass text-[11px] font-mono-data whitespace-nowrap pointer-events-none"
          style={{ left: hoverX }}
        >
          $0.00
        </div>
      )}

      <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] font-mono-data text-on-surface-variant/40 uppercase tracking-wide">
        {labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  )
}
