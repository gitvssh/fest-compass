export function Guardrail({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm leading-6 text-ink">
      <b className="text-coral">!</b>
      <div>{children}</div>
    </div>
  );
}
