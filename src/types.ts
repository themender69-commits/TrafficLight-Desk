export type LightStatus = 'idle' | 'working' | 'done' | 'waiting';

export type AiTool = 'cursor' | 'codex' | 'claude' | 'trae';

export interface StatusPayload {
  status: LightStatus;
  tool?: AiTool;
  message?: string;
  updatedAt: number;
  connected?: boolean;
  /** Hook 近期有回调，监控有效 */
  monitoring?: boolean;
  lastHookAt?: number | null;
}

export interface ToolInfo {
  id: AiTool;
  label: string;
  found: boolean;
  supportsHooks: boolean;
  connected: boolean;
  monitoring?: boolean;
  configDir?: string;
  installHint?: string;
  note?: string;
  unsupportedReason?: string;
  hint?: string;
}

export const STATUS_LABELS: Record<LightStatus, string> = {
  idle: '待命',
  working: '正在干活，别催',
  done: '任务结束，可以验收',
  waiting: '等你切回界面操作',
};

export const TOOL_LABELS: Record<AiTool, string> = {
  cursor: 'Cursor',
  codex: 'Codex',
  claude: 'Claude Code',
  trae: 'Trae',
};

export const DEFAULT_STATUS: StatusPayload = {
  status: 'idle',
  tool: 'cursor',
  updatedAt: Date.now(),
  connected: false,
  monitoring: false,
};

export const API_BASE = 'http://127.0.0.1:9876';
