import type { AiTool } from '../types';
import { TOOL_LABELS } from '../types';
import { logoSrc } from '../utils/logoSrc';

interface ToolLogoProps {
  tool: AiTool;
  connected?: boolean;
  monitoring?: boolean;
  onClick?: () => void;
}

function badgeTitle(connected: boolean, monitoring: boolean): string {
  if (monitoring) {
    return ' · 监控中';
  }
  if (connected) {
    return ' · 已连接，监控未激活';
  }
  return ' · 点击选择监控对象';
}

export function ToolLogo({
  tool,
  connected = false,
  monitoring = false,
  onClick,
}: ToolLogoProps) {
  return (
    <button
      type="button"
      className="tool-logo"
      onClick={onClick}
      title={`${TOOL_LABELS[tool]}${badgeTitle(connected, monitoring)}`}
      aria-label={`${TOOL_LABELS[tool]} 监控`}
    >
      <img src={logoSrc(tool)} alt="" className="tool-logo__image" />
      <span
        className={[
          'tool-logo__badge',
          monitoring ? 'tool-logo__badge--on' : 'tool-logo__badge--off',
        ].join(' ')}
      />
    </button>
  );
}
