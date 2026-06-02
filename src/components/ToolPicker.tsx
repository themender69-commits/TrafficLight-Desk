import { useEffect, useState } from 'react';
import type { ToolInfo, AiTool } from '../types';
import { API_BASE, TOOL_LABELS } from '../types';
import { logoSrc } from '../utils/logoSrc';

interface ToolPickerProps {
  activeTool: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function ToolPicker({
  activeTool,
  onClose,
  onChanged,
}: ToolPickerProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/tools`)
      .then((res) => res.json())
      .then((data) => setTools(data.tools || []))
      .catch(() => setError('无法读取工具列表'));
  }, []);

  async function connect(toolId: string) {
    setBusy(toolId);
    setError(null);
    try {
      const detectRes = await fetch(`${API_BASE}/tools/${toolId}/detect`);
      const detection = await detectRes.json();
      if (!detection.supportsHooks) {
        setError(detection.unsupportedReason || '该工具暂不支持');
        return;
      }
      if (!detection.found) {
        setError(detection.hint || '未找到配置目录');
        return;
      }

      const ok = window.confirm(
        [
          `连接 ${TOOL_LABELS[toolId as AiTool] || toolId}`,
          '',
          detection.installHint || '',
          detection.note || '',
          '',
          '仅写入 Hook 配置与本机状态文件。',
          '不访问网络、不读取项目代码、不需要管理员权限。',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      if (!ok) {
        return;
      }

      const res = await fetch(`${API_BASE}/tools/${toolId}/connect`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '连接失败');
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy('disconnect');
    setError(null);
    try {
      await fetch(`${API_BASE}/connection`, { method: 'DELETE' });
      onChanged();
      onClose();
    } catch {
      setError('断开失败');
    } finally {
      setBusy(null);
    }
  }

  async function restartApp() {
    setBusy('restart');
    setError(null);
    try {
      await fetch(`${API_BASE}/app/restart`, { method: 'POST' });
    } catch {
      setError('重启失败');
      setBusy(null);
    }
  }

  async function quitApp() {
    setBusy('quit');
    setError(null);
    try {
      await fetch(`${API_BASE}/app/quit`, { method: 'POST' });
    } catch {
      setError('退出失败');
      setBusy(null);
    }
  }

  return (
    <aside className="tool-picker" role="menu">
      <div className="tool-picker__header">
        <span className="tool-picker__title">选择监控对象</span>
        <button
          type="button"
          className="tool-picker__close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <ul className="tool-picker__list">
        {tools.map((tool) => (
          <li key={tool.id}>
            <button
              type="button"
              className={[
                'tool-picker__item',
                tool.connected ? 'tool-picker__item--active' : '',
              ].join(' ')}
              disabled={!tool.supportsHooks || busy !== null}
              onClick={() => connect(tool.id)}
            >
              <img src={logoSrc(tool.id)} alt="" className="tool-picker__icon" />
              <span className="tool-picker__meta">
                <span className="tool-picker__label">{tool.label}</span>
                <span className="tool-picker__hint">
                  {!tool.supportsHooks
                    ? tool.unsupportedReason || '暂不支持'
                    : tool.connected
                      ? '已连接'
                      : tool.found
                        ? tool.configDir
                        : tool.hint || '未检测到配置'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {activeTool ? (
        <button
          type="button"
          className="tool-picker__disconnect"
          disabled={busy !== null}
          onClick={disconnect}
        >
          断开连接
        </button>
      ) : null}

      {error ? <div className="tool-picker__error">{error}</div> : null}

      <div className="tool-picker__footer">
        <button
          type="button"
          className="tool-picker__action"
          disabled={busy !== null}
          onClick={restartApp}
        >
          重启
        </button>
        <button
          type="button"
          className="tool-picker__action tool-picker__action--quit"
          disabled={busy !== null}
          onClick={quitApp}
        >
          退出
        </button>
      </div>
    </aside>
  );
}
