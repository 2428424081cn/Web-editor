/* ============================================
   Toolbar - 工具栏组件
   ============================================ */

class Toolbar {
  constructor() {
    this.el = document.getElementById('toolbar');
    this.richTextTools = document.getElementById('richTextTools');
    this.codeTools = document.getElementById('codeTools');
    this.markdownTools = document.getElementById('markdownTools');
    this.langSelect = document.getElementById('langSelect');
    this._currentMode = 'rich-text';
    this._init();
  }

  _init() {
    // 模式切换按钮
    this.el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setMode(mode);
        window.eventBus.emit(EVENTS.EDITOR_MODE_CHANGED, mode);
      });
    });

    // 富文本格式化按钮
    this.richTextTools.querySelectorAll('[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.eventBus.emit(EVENTS.FORMAT_APPLIED, btn.dataset.format);
      });
    });

    // 通用操作按钮
    this.el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.eventBus.emit(EVENTS.ACTION, btn.dataset.action);
      });
    });

    // Markdown 工具按钮
    this.markdownTools.querySelectorAll('[data-md]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.eventBus.emit(EVENTS.ACTION, { type: 'md-insert', format: btn.dataset.md });
      });
    });

    // 语言选择
    if (this.langSelect) {
      this.langSelect.addEventListener('change', () => {
        window.eventBus.emit(EVENTS.ACTION, { type: 'lang-change', lang: this.langSelect.value });
      });
    }

    // 监听模式切换事件
    window.eventBus.on(EVENTS.EDITOR_MODE_CHANGED, (mode) => this.setMode(mode));
  }

  /**
   * 设置当前模式
   */
  setMode(mode) {
    this._currentMode = mode;

    // 更新按钮状态
    this.el.querySelectorAll('[data-mode]').forEach(btn => {
      DOM.toggleClass(btn, 'active', btn.dataset.mode === mode);
    });

    // 显示/隐藏对应工具组
    this.richTextTools.style.display = mode === 'rich-text' ? '' : 'none';
    this.codeTools.style.display = mode === 'code' ? '' : 'none';
    this.markdownTools.style.display = mode === 'markdown' ? '' : 'none';

    // 更新状态栏
    const modeNames = { 'rich-text': '富文本', 'code': '代码', 'markdown': 'Markdown' };
    const statusMode = document.getElementById('statusMode');
    if (statusMode) statusMode.textContent = modeNames[mode] || mode;
  }

  /**
   * 更新富文本工具栏状态（加粗/斜体等激活状态）
   */
  updateFormatState(format, isActive) {
    const btn = this.richTextTools.querySelector(`[data-format="${format}"]`);
    if (btn) DOM.toggleClass(btn, 'active', isActive);
  }
}

// 全局单例
window.toolbar = new Toolbar();
