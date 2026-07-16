import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CategoryRail from '../../components/console/CategoryRail'
import { SkeletonCardGrid } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'

interface MarketplaceService {
  id: string
  name: string
  description: string
  pricePerCall: string
  reputationScore: number
  kind: 'nanopayment' | 'job'
  providerAddress: string
}

const CATEGORIES = [
  { label: 'Data & Research', icon: 'query_stats' },
  { label: 'Trading & Execution', icon: 'candlestick_chart' },
  { label: 'Risk & Compliance', icon: 'gavel' },
  { label: 'Automation', icon: 'auto_awesome' },
]

export default function AgentMarketplace() {
  const navigate = useNavigate()
  const loading = useSimulatedLoading()
  const [active, setActive] = useState<string | undefined>(undefined)
  const [services] = useState<MarketplaceService[]>([])

  const handlePayAndUse = (service: MarketplaceService) => {
    if (service.kind === 'nanopayment') {
      navigate('/console/nanopayments', {
        state: { prefillRecipient: service.providerAddress, prefillAmount: service.pricePerCall },
      })
    } else {
      navigate('/console/agentic-jobs', {
        state: {
          prefillProvider: service.providerAddress,
          prefillTask: service.description,
          prefillEscrow: service.pricePerCall,
        },
      })
    }
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h2 className="page-title text-headline-xl">Agent Marketplace</h2>
        <p className="page-subtitle mt-1">Discover and pay agent services directly from the console</p>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <CategoryRail categories={CATEGORIES} active={active} onSelect={(label) => setActive(label === active ? undefined : label)} />

        <div className="col-span-12 md:col-span-10">
          {loading ? (
            <SkeletonCardGrid count={3} />
          ) : services.length === 0 ? (
            <div className="glass-premium rounded-2xl p-14 empty-state">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined">storefront</span>
              </div>
              <p className="empty-state-title">No agent services listed yet</p>
              <p className="empty-state-desc">Services published to the Arc Agent Marketplace will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
              {services.map((service) => (
                <div key={service.id} className="glass-premium card-interactive p-6 rounded-2xl flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="icon-well bg-primary/10 border-primary/15">
                      <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
                    </div>
                    <p className="font-bold tracking-tight text-sm truncate">{service.name}</p>
                  </div>
                  <p className="text-body-sm text-on-surface-variant/70 leading-relaxed flex-1 mb-4">
                    {service.description}
                  </p>
                  <div className="flex justify-between text-xs mb-4">
                    <span className="text-on-surface-variant/60">Price / call</span>
                    <span className="font-mono-data">{service.pricePerCall} USDC</span>
                  </div>
                  <button type="button" onClick={() => handlePayAndUse(service)} className="btn-primary w-full py-3 text-sm">
                    Pay &amp; Use
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
