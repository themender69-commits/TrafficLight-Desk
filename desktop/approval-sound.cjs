const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

/**
 * 音效与灯色一一对应（与 agent-sound 插件相同系统音）：
 *   waiting / 红灯 → Tink   「请切回界面点确认」
 *   done / 绿灯    → Glass  「本轮完成，可验收」
 *   working / 黄灯 → 无音效
 *
 * Hook 写状态时由 agent-hooks/tl-state.sh 播放（与 POST /status 同刻）。
 * App pending-watch 兜底红灯时由此模块播放 Tink。
 */

function playSystemSound(name) {
  if (process.platform === 'darwin') {
    const file = `/System/Library/Sounds/${name}.aiff`;
    if (fs.existsSync(file)) {
      execFile('afplay', [file], () => {});
    }
    return;
  }
  if (process.platform === 'win32') {
    const wav =
      name === 'Glass'
        ? 'Windows Notify System Generic.wav'
        : 'Windows Notify Calendar.wav';
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `(New-Object Media.SoundPlayer "$env:WINDIR\\Media\\${wav}").Play()`,
      ],
      () => {},
    );
  }
}

function playApprovalSound() {
  playSystemSound('Tink');
}

function playDoneSound() {
  playSystemSound('Glass');
}

module.exports = {
  playApprovalSound,
  playDoneSound,
};
