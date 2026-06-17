const { execFile } = require('child_process');

/** 与 agent-sound 一致：批准框出现时用 Tink 提醒 */
function playApprovalSound() {
  if (process.platform === 'darwin') {
    execFile('afplay', ['/System/Library/Sounds/Tink.aiff'], () => {});
    return;
  }
  if (process.platform === 'win32') {
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        '(New-Object Media.SoundPlayer "$env:WINDIR\\Media\\Windows Notify System Generic.wav").Play()',
      ],
      () => {},
    );
  }
}

module.exports = {
  playApprovalSound,
};
