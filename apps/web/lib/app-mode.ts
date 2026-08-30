import "server-only";

export type AppMode = "editor" | "public-readonly";

export const READ_ONLY_MESSAGE = "현재 서비스는 공개 읽기 전용 모드입니다. 변경 작업은 허용되지 않습니다.";

export class ReadOnlyModeError extends Error {
  readonly code = "APP_READ_ONLY";

  constructor() {
    super(READ_ONLY_MESSAGE);
    this.name = "ReadOnlyModeError";
  }
}

export function resolveAppMode(
  configured = process.env.APP_MODE,
  nodeEnv = process.env.NODE_ENV,
): AppMode {
  if (configured === "editor" || configured === "public-readonly") return configured;
  if (configured?.trim()) return "public-readonly";
  return nodeEnv === "production" ? "public-readonly" : "editor";
}

export function isPublicReadonly(): boolean {
  return resolveAppMode() === "public-readonly";
}

export function assertEditorMode(): void {
  if (isPublicReadonly()) throw new ReadOnlyModeError();
}
