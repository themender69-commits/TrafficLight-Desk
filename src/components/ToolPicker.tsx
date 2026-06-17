import { useEffect, useState } from 'react';
import type { ToolInfo, VersionInfo } from '../types';
import { API_BASE } from '../types';
import { logoSrc } from '../utils/logoSrc';

interface ToolPickerProps {
  activeTool: string | null;
  onClose: () => void;
  onChanged: () => void;
}

function hookSyncLabel(versions: VersionInfo | null): {
  text: string;
  tone: 'ok' | 'warn' | 'muted';
} {
  if (!versions) {
    return { text: '检测中…', tone: 'muted' };
  }
  if (versions.installed == null) {
    return { text: 'Hook 未安装', tone: 'muted' };
  }
  if (versions.aligned) {
    return { text: 'Hook 已同步', tone: 'ok' };
  }
  return { text: `Hook 需更新 · 最新 v${versions.hooksSource}`, tone: 'warn' };
}

export function ToolPicker({
  activeTool,
  onClose,
  onChanged,
}: ToolPickerProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [versions, setVersions] = useState<VersionInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/tools`)
      .then((res) => res.json())
      .then((data) => setTools(data.tools || []))
      .catch(() => setError('无法读取工具列表'));

    fetch(`${API_BASE}/diagnostics/versions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.app) {
          setVersions(data as VersionInfo);
        }
      })
      .catch(() => {
        /* ignore */
      });
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

      const confirmRes = await fetch(
        `${API_BASE}/tools/${toolId}/connect/confirm`,
        { method: 'POST' },
      );
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        setError(confirmData.error || '无法显示授权对话框');
        return;
      }
      if (!confirmData.confirmed) {
        return;
      }

      const res = await fetch(`${API_BASE}/tools/${toolId}/connect`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '连接失败');
      }

      const verRes = await fetch(`${API_BASE}/diagnostics/versions`);
      if (verRes.ok) {
        setVersions(await verRes.json());
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
    <aside
      className="tool-picker"
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
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

      <div className="tool-picker__body">
      <ul className="tool-picker__list">
        {tools
          .filter((tool) => tool.supportsHooks)
          .map((tool) => (
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
                      : tool.monitoring
                        ? '监控中'
                        : tool.connected
                          ? '已连接，监控未激活'
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

      <section className="tool-picker__about" aria-label="关于">
        <div className="tool-picker__about-brand">
          <div className="tool-picker__about-mark" aria-hidden="true">
            <span className="tool-picker__about-dot tool-picker__about-dot--r" />
            <span className="tool-picker__about-dot tool-picker__about-dot--y" />
            <span className="tool-picker__about-dot tool-picker__about-dot--g" />
          </div>
          <div className="tool-picker__about-head">
            <span className="tool-picker__about-title">TrafficLight Desk</span>
            <span className="tool-picker__about-tagline">
              桌面 AI 状态监视 · 本机 Hook · 不联网
            </span>
          </div>
          <span className="tool-picker__about-badge">
            v{versions?.app ?? '…'}
          </span>
        </div>

        <div className="tool-picker__about-meta">
          {(() => {
            const sync = hookSyncLabel(versions);
            return (
              <span
                className={[
                  'tool-picker__about-sync',
                  sync.tone === 'ok' ? 'tool-picker__about-sync--ok' : '',
                  sync.tone === 'warn' ? 'tool-picker__about-sync--warn' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {sync.text}
              </span>
            );
          })()}
          {versions?.installed ? (
            <span className="tool-picker__about-hook-ver">
              Hook v{versions.installed}
            </span>
          ) : null}
        </div>

        <ul className="tool-picker__about-tags">
          <li>黄灯执行中</li>
          <li>红灯需操作</li>
          <li>绿灯可验收</li>
        </ul>
      </section>

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
      </div>
    </aside>
  );
}
