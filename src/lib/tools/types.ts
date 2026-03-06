export interface ToolStep {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
  error?: boolean;
}
