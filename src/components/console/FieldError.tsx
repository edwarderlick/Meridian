export default function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="text-[11px] text-error/80 mt-1.5 flex items-center gap-1" role="alert">
      <span className="material-symbols-outlined text-[13px]">error_outline</span>
      {message}
    </p>
  )
}
