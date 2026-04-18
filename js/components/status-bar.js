/* ============================================
   StatusBar - 状态栏组件
   ============================================ */

class StatusBarComponent {
  constructor() {
    this.cursorEl = document.getElementById('statusCursor');
    this.selectionEl = document.getElementById('statusSelection');
    this.encodingEl = document.getElementById('statusEncoding');
    this.modeEl = document.getElementById('statusMode');
    this.themeEl = document.getElementById('statusTheme');
    this._init();
  }

  _init() {
    // 监听光标变化
    window.eventBus.on(EVENTS.CURSOR_CHANGED, ({ line, col }) => {
      this.cursorEl.textContent = `行 ${line}, 列 ${col}`;
    });

    // 监听选区变化
    window.eventBus.on(EVENTS.SELECTION_CHANGED, (text) => {
      if (text) {
        const len = text.length;
        this.selectionEl.textContent = `(${len} 字符已选中)`;
      } else {
        this.selectionEl.textContent = '';
      }
    });

    // 监听主题变化
    window.eventBus.on(EVENTS.THEME_CHANGED, (theme) => {
      this.themeEl.textContent = theme === 'dark' ? '暗色' : '亮色';
    });
  }

  /**
   * 更新编码显示
   */
  setEncoding(encoding) {
    this.encodingEl.textContent = encoding || 'UTF-8';
  }
}

// 全局单例
window.statusBarComponent = new StatusBarComponent();
