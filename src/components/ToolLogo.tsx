import type { AiTool } from '../types';
import { TOOL_LABELS } from '../types';
import { logoSrc } from '../utils/logoSrc';

interface ToolLogoProps {
  tool: AiTool;
  connected?: boolean;
  onClick?: () => void;
}

export function ToolLogo({ tool, connected = false, onClick }: ToolLogoProps) {
  return (
    <button
      type="button"
      className="tool-logo"
      onClick={onClick}
      title={`${TOOL_LABELS[tool]}${connected ? ' · 已连接' : ' · 点击选择监控对象'}`}
      aria-label={`${TOOL_LABELS[tool]} 监控`}
    >
      <img src={logoSrc(tool)} alt="" className="tool-logo__image" />
      <span
        className={[
          'tool-logo__badge',
          connected ? 'tool-logo__badge--on' : 'tool-logo__badge--off',
        ].join(' ')}
      />
    </button>
  );
}
