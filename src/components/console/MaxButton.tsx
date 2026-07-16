export default function MaxButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[11px] font-mono-data font-bold text-primary hover:bg-primary/20 hover:border-primary/35 active:scale-95 transition-premium"
    >
      MAX
    </button>
  )
}
