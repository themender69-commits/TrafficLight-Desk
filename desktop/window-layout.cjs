const LIGHT_WIDTH = 118;
const MENU_WIDTH = 288;
const GAP = 8;
const MARGIN_RIGHT = 20;
const WINDOW_Y = 80;
/* shell ~331 + glass 12 + app padding 8 + 绿灯光晕 ~20 */
const WINDOW_HEIGHT = 382;

function createWindowLayout(getMainWindow) {
  function setMenuOpen(menuOpen) {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      return;
    }

    const { width: screenW } = require('electron').screen.getPrimaryDisplay()
      .workAreaSize;

    if (menuOpen) {
      const totalW = MENU_WIDTH + GAP + LIGHT_WIDTH;
      win.setBounds({
        x: Math.round(screenW - totalW - MARGIN_RIGHT),
        y: WINDOW_Y,
        width: totalW,
        height: WINDOW_HEIGHT,
      });
    } else {
      win.setBounds({
        x: Math.round(screenW - LIGHT_WIDTH - MARGIN_RIGHT),
        y: WINDOW_Y,
        width: LIGHT_WIDTH,
        height: WINDOW_HEIGHT,
      });
    }
  }

  function getInitialBounds(screenW) {
    return {
      x: Math.round(screenW - LIGHT_WIDTH - MARGIN_RIGHT),
      y: WINDOW_Y,
      width: LIGHT_WIDTH,
      height: WINDOW_HEIGHT,
    };
  }

  return { setMenuOpen, getInitialBounds, LIGHT_WIDTH, WINDOW_HEIGHT };
}

module.exports = { createWindowLayout };
