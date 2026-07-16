import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SkeletonCardGrid } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'

interface RegisteredAgent {
  address: string
  name: string
  reputationScore: number
  attestationCount: number
}

function AgentDetail({ agent, onBack }: { agent: RegisteredAgent; onBack: () => void }) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-on-surface-variant/70 hover:text-primary font-label-caps text-[11px] tracking-[0.12em] transition-premium"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to agents
      </button>

      <div className="glass-premium rounded-2xl p-8">
        <div className="flex justify-between items-start mb-8 gap-4">
          <div>
            <h3 className="font-headline-lg text-[22px] font-semibold tracking-tight mb-1">{agent.name}</h3>
            <p className="font-mono-data text-sm text-on-surface-variant/60">{agent.address}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/console/agentic-jobs', { state: { prefillProvider: agent.address } })}
            className="btn-primary px-5 py-2.5 text-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">work</span>
            Hire This Agent
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="glass rounded-xl p-4 flex flex-col gap-1.5">
            <span className="field-label !text-[10px]">Reputation Score</span>
            <span className="font-mono-data text-sm font-bold text-on-surface">{agent.reputationScore}</span>
          </div>
          <div className="glass rounded-xl p-4 flex flex-col gap-1.5">
            <span className="field-label !text-[10px]">Attested Jobs</span>
            <span className="font-mono-data text-sm font-bold text-on-surface">{agent.attestationCount}</span>
          </div>
        </div>

        <div className="empty-state py-10">
          <div className="empty-state-icon">
            <span className="material-symbols-outlined">history</span>
          </div>
          <p className="empty-state-title">No reputation history yet</p>
          <p className="empty-state-desc">Completed job attestations for this agent will appear here</p>
        </div>
      </div>
    </div>
  )
}

export default function AgentIdentity() {
  const loading = useSimulatedLoading()
  const [query, setQuery] = useState('')
  const [agents] = useState<RegisteredAgent[]>([])
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

  const filtered = agents.filter(
    (a) => a.name.toLowerCase().includes(query.toLowerCase()) || a.address.toLowerCase().includes(query.toLowerCase()),
  )
  const selectedAgent = agents.find((a) => a.address === selectedAddress) ?? null

  if (selectedAgent) {
    return (
      <div className="space-y-8">
        <div className="page-header">
          <h2 className="page-title text-headline-xl">Agent Identity & Reputation</h2>
          <p className="page-subtitle mt-1">ERC-8004 onchain agent identity registry</p>
        </div>
        <AgentDetail agent={selectedAgent} onBack={() => setSelectedAddress(null)} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h2 className="page-title text-headline-xl">Agent Identity & Reputation</h2>
        <p className="page-subtitle mt-1">Browse registered agents and their onchain attestation history</p>
      </div>

      <div className="relative max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search agents by name or address"
          className="input-premium py-3 pl-11 pr-4 text-sm rounded-xl"
          placeholder="Search by name or address…"
          type="text"
        />
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/45 text-[18px]">
          search
        </span>
      </div>

      {loading ? (
        <SkeletonCardGrid count={3} />
      ) : filtered.length === 0 ? (
        <div className="glass-premium rounded-2xl p-14 empty-state">
          <div className="empty-state-icon">
            <span className="material-symbols-outlined">verified_user</span>
          </div>
          <p className="empty-state-title">No registered agents yet</p>
          <p className="empty-state-desc">Agents registered via ERC-8004 identity on Arc Testnet will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {filtered.map((agent) => (
            <button
              key={agent.address}
              type="button"
              onClick={() => setSelectedAddress(agent.address)}
              className="glass-premium card-interactive p-6 rounded-2xl text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-well bg-primary/10 border-primary/15">
                  <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold tracking-tight text-sm truncate">{agent.name}</p>
                  <p className="font-mono-data text-[11px] text-on-surface-variant/50 truncate">{agent.address}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant/60">Reputation</span>
                <span className="font-mono-data">{agent.reputationScore}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
