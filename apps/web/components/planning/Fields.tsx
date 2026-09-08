import type { ReactNode } from "react";
export function Field({ label, value, onChange, multiline = false, type = "text", max = 2000 }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string; max?: number }) {
  return <label className="block min-w-0 space-y-2 text-sm font-bold"><span>{label}</span>{multiline ? <textarea className="workspace-input min-h-24" maxLength={max} value={value} onChange={e => onChange(e.target.value)} /> : <input className="workspace-input" type={type} maxLength={max} value={value} onChange={e => onChange(e.target.value)} />}</label>;
}
export function Select({ label, value, onChange, options, children }: { label: string; value: string; onChange: (v: string) => void; options?: Record<string, string>; children?: ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-sm font-bold"><span>{label}</span><select aria-label={label} className="workspace-input" value={value} onChange={e => onChange(e.target.value)}>{options && Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}{children}</select></label>;
}
