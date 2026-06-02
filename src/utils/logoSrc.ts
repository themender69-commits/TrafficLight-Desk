import type { AiTool } from '../types';

/** Electron file:// 下必须用相对路径，不能用 /logos/... */
export function logoSrc(tool: AiTool): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}logos/${tool}-logo.svg`;
}
