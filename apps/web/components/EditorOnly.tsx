import { isPublicReadonly } from "@/lib/app-mode";

export function EditorOnly({ children }: { children: React.ReactNode }) {
  return isPublicReadonly() ? null : children;
}
