import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonTable } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'
import { addressError, amountError } from '../../lib/validation'

const AVAILABLE_BALANCE = 0

type JobStatus = 'Open' | 'Funded' | 'Submitted' | 'Terminal'

interface Job {
  id: string
  task: string
  escrow: string
  provider: string
  evaluator: string
  status: JobStatus
  outcome?: 'Accepted' | 'Rejected'
}

const EVALUATOR_OPTIONS = [
  { value: 'self', label: 'Self (this wallet)' },
  { value: 'other', label: 'Another address' },
]

const STATUS_META: Record<JobStatus, { style: string; icon: string }> = {
  Open: { style: 'bg-secondary/10 text-secondary border-secondary/25', icon: 'assignment' },
  Funded: { style: 'bg-tertiary/10 text-tertiary border-tertiary/25', icon: 'lock' },
  Submitted: { style: 'bg-primary/10 text-primary border-primary/25', icon: 'upload_file' },
  Terminal: { style: 'bg-white/[0.03] text-on-surface-variant/45 border-white/[0.08]', icon: 'flag' },
}

const LIFECYCLE_STEPS: { status: JobStatus; label: string; desc: string }[] = [
  { status: 'Open', label: 'Open', desc: 'Job posted, awaiting escrow funding' },
  { status: 'Funded', label: 'Funded', desc: 'USDC escrowed onchain' },
  { status: 'Submitted', label: 'Submitted', desc: 'Provider submitted a deliverable' },
  { status: 'Terminal', label: 'Terminal', desc: 'Evaluator accepted or rejected' },
]

function StatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full border font-label-caps text-[9px] uppercase tracking-wider ${meta.style}`}
    >
      <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
      {status}
    </span>
  )
}

function JobDetail({ job, onBack, onUpdate }: { job: Job; onBack: () => void; onUpdate: (job: Job) => void }) {
  const [fundingConfirm, setFundingConfirm] = useState(false)
  const [funding, setFunding] = useState(false)
  const [reviewAction, setReviewAction] = useState<'Accepted' | 'Rejected' | null>(null)

  const stepIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === job.status)

  const handleFund = () => {
    setFunding(true)
    setTimeout(() => {
      setFunding(false)
      setFundingConfirm(false)
      onUpdate({ ...job, status: 'Funded' })
    }, 900)
  }

  const handleResolve = () => {
    if (!reviewAction) return
    onUpdate({ ...job, status: 'Terminal', outcome: reviewAction })
    setReviewAction(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-on-surface-variant/70 hover:text-primary font-label-caps text-[11px] tracking-[0.12em] transition-premium"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to jobs
      </button>

      <div className="glass-premium rounded-2xl p-8">
        <div className="flex justify-between items-start mb-8 gap-4">
          <div>
            <h3 className="font-headline-lg text-[20px] font-semibold tracking-tight mb-1">{job.task}</h3>
            <p className="text-body-sm text-on-surface-variant/60">Job ID: {job.id}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="relative mb-10">
          <div className="absolute top-5 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent z-0" />
          <div className="grid grid-cols-4 relative z-10">
            {LIFECYCLE_STEPS.map((step, i) => (
              <div key={step.status} className="flex flex-col items-center gap-3">
                <div
                  className={`icon-well w-11 h-11 rounded-full ${i <= stepIndex ? STATUS_META[step.status].style : ''}`}
                >
                  <span
                    className={`material-symbols-outlined text-lg ${i <= stepIndex ? '' : 'text-on-surface-variant/55'}`}
                  >
                    {STATUS_META[step.status].icon}
                  </span>
                </div>
                <span className="font-mono-data text-xs font-bold text-on-surface-variant/60">{step.label}</span>
                <p className="hidden sm:block text-[10px] text-on-surface-variant/40 text-center px-4 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-xl p-4 flex flex-col gap-1.5">
            <span className="field-label !text-[10px]">Escrowed Amount</span>
            <span className="font-mono-data text-sm font-bold text-on-surface">{job.escrow} USDC</span>
          </div>
          <div className="glass rounded-xl p-4 flex flex-col gap-1.5">
            <span className="field-label !text-[10px]">Provider</span>
            <span className="font-mono-data text-sm font-bold text-on-surface truncate">{job.provider}</span>
          </div>
          <div className="glass rounded-xl p-4 flex flex-col gap-1.5">
            <span className="field-label !text-[10px]">Evaluator</span>
            <span className="font-mono-data text-sm font-bold text-on-surface truncate">{job.evaluator}</span>
          </div>
        </div>

        {job.status === 'Open' && (
          <button
            type="button"
            onClick={() => setFundingConfirm(true)}
            className="btn-primary w-full py-4 rounded-xl text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Fund Escrow
          </button>
        )}

        {job.status === 'Funded' && (
          <div className="glass rounded-xl px-5 py-4 flex items-center gap-3 border-tertiary/20 bg-tertiary/5">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">hourglass_top</span>
            <p className="text-body-sm text-tertiary font-medium">Awaiting deliverable submission from provider</p>
          </div>
        )}

        {job.status === 'Submitted' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setReviewAction('Rejected')}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold border border-error/30 bg-error/10 text-error hover:bg-error/15 transition-premium"
            >
              Reject
            </button>
            <button type="button" onClick={() => setReviewAction('Accepted')} className="btn-primary flex-1 py-3.5 text-sm">
              Accept
            </button>
          </div>
        )}

        {job.status === 'Terminal' && (
          <div className="glass rounded-xl px-5 py-4 flex items-center gap-3">
            <span
              className={`material-symbols-outlined text-[20px] shrink-0 ${job.outcome === 'Accepted' ? 'text-primary' : 'text-error'}`}
            >
              {job.outcome === 'Accepted' ? 'check_circle' : 'cancel'}
            </span>
            <p className="text-body-sm font-medium">Job {job.outcome?.toLowerCase()} by evaluator</p>
          </div>
        )}
      </div>

      <ReviewModal
        open={fundingConfirm}
        onClose={() => setFundingConfirm(false)}
        onConfirm={handleFund}
        confirming={funding}
        title="Fund Escrow"
        confirmLabel="Fund Escrow"
        rows={[
          { label: 'Amount', value: `${job.escrow} USDC`, accent: true },
          { label: 'Provider', value: job.provider },
        ]}
      />

      <ReviewModal
        open={reviewAction !== null}
        onClose={() => setReviewAction(null)}
        onConfirm={handleResolve}
        title={reviewAction === 'Rejected' ? 'Reject Deliverable' : 'Accept Deliverable'}
        confirmLabel={reviewAction === 'Rejected' ? 'Reject & Refund' : 'Accept & Release Escrow'}
        destructive={reviewAction === 'Rejected'}
        rows={[
          { label: 'Escrowed Amount', value: `${job.escrow} USDC`, accent: true },
          { label: 'Provider', value: job.provider },
        ]}
      />
    </div>
  )
}

function AgenticJobsScreen() {
  const location = useLocation() as {
    state?: { prefillProvider?: string; prefillTask?: string; prefillEscrow?: string }
  }
  const loading = useSimulatedLoading()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [task, setTask] = useState(location.state?.prefillTask ?? '')
  const [escrow, setEscrow] = useState(location.state?.prefillEscrow ?? '')
  const [provider, setProvider] = useState(location.state?.prefillProvider ?? '')
  const [evaluatorKind, setEvaluatorKind] = useState('self')
  const [evaluatorAddress, setEvaluatorAddress] = useState('')
  const [touched, setTouched] = useState(false)

  const taskMsg = useMemo(() => (task.trim() ? null : 'Task description is required'), [task])
  const escrowMsg = useMemo(() => amountError(escrow, AVAILABLE_BALANCE), [escrow])
  const providerMsg = useMemo(() => addressError(provider), [provider])
  const evaluatorMsg = useMemo(
    () => (evaluatorKind === 'other' ? addressError(evaluatorAddress) : null),
    [evaluatorKind, evaluatorAddress],
  )
  const isValid = !taskMsg && !escrowMsg && !providerMsg && !evaluatorMsg

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null

  const handleCreate = () => {
    setTouched(true)
    if (!isValid) return
    setJobs((prev) => [
      ...prev,
      {
        id: `job-${Date.now()}`,
        task,
        escrow,
        provider,
        evaluator: evaluatorKind === 'self' ? 'Self (this wallet)' : evaluatorAddress,
        status: 'Open',
      },
    ])
    setTask('')
    setEscrow('')
    setProvider('')
    setEvaluatorKind('self')
    setEvaluatorAddress('')
    setTouched(false)
  }

  const handleUpdateJob = (updated: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)))
  }

  if (selectedJob) {
    return (
      <div className="space-y-8">
        <div className="page-header">
          <h2 className="page-title text-headline-xl">Agentic Jobs</h2>
          <p className="page-subtitle mt-1">ERC-8183 job escrow lifecycle</p>
        </div>
        <JobDetail job={selectedJob} onBack={() => setSelectedJobId(null)} onUpdate={handleUpdateJob} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h2 className="page-title text-headline-xl">Agentic Jobs</h2>
        <p className="page-subtitle mt-1">Post escrowed work for autonomous agents via the ERC-8183 protocol</p>
      </div>

      <div className="glass-premium rounded-2xl p-8">
        <h3 className="font-headline-lg text-[20px] font-semibold tracking-tight mb-6">Create Job</h3>
        <div className="space-y-5">
          <div>
            <label htmlFor="job-task" className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
              Task Description
            </label>
            <textarea
              id="job-task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface resize-none"
              placeholder="Describe the task the agent should complete…"
            />
            {touched && <FieldError message={taskMsg} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="job-escrow" className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Escrow Budget (USDC)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="job-escrow"
                  value={escrow}
                  onChange={(e) => setEscrow(e.target.value)}
                  onBlur={() => setTouched(true)}
                  inputMode="decimal"
                  className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                  placeholder="0.00"
                  type="text"
                />
                <MaxButton onClick={() => setEscrow(String(AVAILABLE_BALANCE))} />
              </div>
              {touched && <FieldError message={escrowMsg} />}
            </div>
            <div>
              <label htmlFor="job-provider" className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Provider Address
              </label>
              <input
                id="job-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                onBlur={() => setTouched(true)}
                className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                placeholder="0x... or ENS"
                type="text"
              />
              {touched && <FieldError message={providerMsg} />}
            </div>
          </div>

          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">Evaluator</label>
            <Dropdown
              value={evaluatorKind}
              onChange={setEvaluatorKind}
              options={EVALUATOR_OPTIONS}
              ariaLabel="Select evaluator"
              triggerClassName="w-full flex items-center justify-between bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm text-on-surface transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected, open) => (
                <>
                  <span>{selected?.label}</span>
                  <span className={`material-symbols-outlined text-[18px] opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </>
              )}
            />
            {evaluatorKind === 'other' && (
              <div className="mt-3">
                <input
                  value={evaluatorAddress}
                  onChange={(e) => setEvaluatorAddress(e.target.value)}
                  onBlur={() => setTouched(true)}
                  className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                  placeholder="Evaluator 0x... or ENS"
                  type="text"
                />
                {touched && <FieldError message={evaluatorMsg} />}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!isValid}
            className="btn-primary w-full py-4 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Job
          </button>
        </div>
      </div>

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Jobs</h3>
        </div>
        {loading ? (
          <SkeletonTable rows={3} columns={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-label-caps text-[10px] text-on-surface-variant/40 border-b border-white/[0.06]">
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Task</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Escrow</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Evaluator</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Status</th>
                </tr>
              </thead>
              {jobs.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="p-14 empty-state">
                        <div className="empty-state-icon">
                          <span className="material-symbols-outlined">work</span>
                        </div>
                        <p className="empty-state-title">No jobs posted yet</p>
                        <p className="empty-state-desc">Create a job above to escrow USDC for agent-completed work</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-white/[0.04] font-body-sm">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View job: ${job.task}`}
                      onClick={() => setSelectedJobId(job.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedJobId(job.id)
                        }
                      }}
                      className="table-row cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 focus-visible:-outline-offset-2"
                    >
                      <td className="px-6 py-4 font-bold tracking-tight truncate max-w-xs">{job.task}</td>
                      <td className="px-6 py-4 text-right font-mono-data">{job.escrow} USDC</td>
                      <td className="px-6 py-4 text-on-surface-variant/70 truncate max-w-[160px]">{job.evaluator}</td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgenticJobs() {
  return (
    <RequireWallet noun="agentic jobs">
      <AgenticJobsScreen />
    </RequireWallet>
  )
}
