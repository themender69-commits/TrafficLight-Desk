import { useEffect, useState } from 'react';
import type { LightStatus, AiTool } from '../types';
import { API_BASE } from '../types';
import { ToolLogo } from './ToolLogo';
import { ToolPicker } from './ToolPicker';
import { STATUS_LABELS } from '../types';

interface TrafficLightProps {
  status: LightStatus;
  tool: AiTool;
  connected: boolean;
  onRefresh: () => void;
}

function Light({
  color,
  active,
  flash = false,
}: {
  color: 'red' | 'yellow' | 'green';
  active: boolean;
  flash?: boolean;
}) {
  return (
    <div className={`light-housing light-housing--${color}`}>
      <div
        className={[
          'light-bulb',
          `light-bulb--${color}`,
          active ? 'light-bulb--on' : 'light-bulb--off',
          flash ? 'light-bulb--flash' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    </div>
  );
}

async function setWindowMenuOpen(menuOpen: boolean) {
  try {
    await fetch(`${API_BASE}/app/window-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuOpen }),
    });
  } catch {
    /* ignore */
  }
}

export function TrafficLight({
  status,
  tool,
  connected,
  onRefresh,
}: TrafficLightProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isWorking = status === 'working';
  const isDone = status === 'done';
  const isWaiting = status === 'waiting';

  useEffect(() => {
    setWindowMenuOpen(pickerOpen);
    return () => {
      setWindowMenuOpen(false);
    };
  }, [pickerOpen]);

  function togglePicker() {
    setPickerOpen((open) => !open);
  }

  function closePicker() {
    setPickerOpen(false);
  }

  return (
    <div className="traffic-light-layout">
      {pickerOpen ? (
        <ToolPicker
          activeTool={connected ? tool : null}
          onClose={closePicker}
          onChanged={onRefresh}
        />
      ) : null}

      <div className="traffic-light" title={STATUS_LABELS[status]}>
        <div className="traffic-light__glass">
          <div className="traffic-light__shell">
            <div className="traffic-light__icon">
              <ToolLogo
                tool={tool}
                connected={connected}
                onClick={togglePicker}
              />
            </div>

            <div className="traffic-light__divider" />

            <Light color="red" active={isWaiting} flash={isWaiting} />
            <div className="traffic-light__divider" />
            <Light color="yellow" active={isWorking} flash={isWorking} />
            <div className="traffic-light__divider" />
            <Light color="green" active={isDone} />

            <div className="traffic-light__label" aria-live="polite">
              {STATUS_LABELS[status]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
