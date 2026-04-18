/* ============================================
   CodeEditor - 代码编辑器组件
   ============================================ */

class CodeEditor {
  constructor() {
    this.textarea = document.getElementById('codeTextarea');
    this.highlightLayer = document.getElementById('codeHighlightLayer');
    this.lineNumbers = document.getElementById('lineNumbers');
    this.panel = document.getElementById('codePanel');
    this._language = 'javascript';
    this._wordWrap = false;
    this._lastContent = '';
    this._init();
  }

  _init() {
    // 输入事件
    this.textarea.addEventListener('input', () => this._handleInput());
    this.textarea.addEventListener('scroll', () => this._syncScroll());
    this.textarea.addEventListener('keydown', (e) => this._handleKeyDown(e));
    this.textarea.addEventListener('click', () => this._updateCursor());
    this.textarea.addEventListener('keyup', () => this._updateCursor());

    // Tab 键支持
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this._insertTab();
      }
    });

    // 监听语言切换
    window.eventBus.on(EVENTS.ACTION, (action) => {
      if (action && action.type === 'lang-change') {
        this.setLanguage(action.lang);
      }
      if (action === 'toggle-wordwrap') {
        this.toggleWordWrap();
      }
      if (action === 'auto-indent') {
        this._autoIndent();
      }
    });

    // 监听标签切换
    window.eventBus.on(EVENTS.TAB_SWITCHED, (tab) => {
      if (tab.mode === 'code') {
        this.show();
        this.setContent(tab.content || '');
        this.setLanguage(tab.language || 'javascript');
      }
    });

    // 监听撤销/重做
    window.eventBus.on(EVENTS.UNDO, () => {
      if (this.panel.classList.contains('active')) {
        document.execCommand('undo');
      }
    });
    window.eventBus.on(EVENTS.REDO, () => {
      if (this.panel.classList.contains('active')) {
        document.execCommand('redo');
      }
    });
  }

  /**
   * 显示编辑器
   */
  show() {
    this.panel.classList.add('active');
    this.textarea.focus();
    this._updateHighlight();
    this._updateLineNumbers();
  }

  /**
   * 隐藏编辑器
   */
  hide() {
    this.panel.classList.remove('active');
  }

  /**
   * 获取内容
   */
  getContent() {
    return this.textarea.value;
  }

  /**
   * 设置内容
   */
  setContent(code) {
    this.textarea.value = code || '';
    this._lastContent = code || '';
    this._updateHighlight();
    this._updateLineNumbers();
    window.historyManager.clear();
  }

  /**
   * 设置语言
   */
  setLanguage(lang) {
    this._language = lang;
    const langSelect = document.getElementById('langSelect');
    if (langSelect) langSelect.value = lang;
    this._updateHighlight();
  }

  /**
   * 切换自动换行
   */
  toggleWordWrap() {
    this._wordWrap = !this._wordWrap;
    DOM.toggleClass(this.textarea, 'word-wrap', this._wordWrap);
    DOM.toggleClass(this.highlightLayer, 'word-wrap', this._wordWrap);
  }

  /**
   * 处理输入
   */
  _handleInput() {
    const content = this.textarea.value;
    if (content !== this._lastContent) {
      window.historyManager.pushSnapshot(this._lastContent);
      this._lastContent = content;
    }

    this._updateHighlight();
    this._updateLineNumbers();

    const tab = window.tabManager.getActiveTab();
    if (tab) {
      window.tabManager.updateTab(tab.id, { dirty: true });
    }

    window.eventBus.emit(EVENTS.CONTENT_CHANGED, {
      mode: 'code',
      content: this.textarea.value
    });
  }

  /**
   * 处理键盘事件
   */
  _handleKeyDown(e) {
    // Enter 自动缩进
    if (e.key === 'Enter') {
      const start = this.textarea.selectionStart;
      const lineStart = this.textarea.value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = this.textarea.value.substring(lineStart, start);
      const indent = currentLine.match(/^\s*/)[0];

      // 如果行末是 { 或 : ，增加缩进
      const lastChar = currentLine.trim().slice(-1);
      const extraIndent = (lastChar === '{' || lastChar === ':') ? '  ' : '';

      if (indent || extraIndent) {
        e.preventDefault();
        const insertion = '\n' + indent + extraIndent;
        document.execCommand('insertText', false, insertion);
      }
    }

    // 自动闭合括号
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    if (pairs[e.key]) {
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;

      if (start !== end) {
        // 包裹选区
        e.preventDefault();
        const selected = this.textarea.value.substring(start, end);
        document.execCommand('insertText', false, e.key + selected + pairs[e.key]);
      }
    }
  }

  /**
   * 插入 Tab
   */
  _insertTab() {
    document.execCommand('insertText', false, '  ');
  }

  /**
   * 自动缩进
   */
  _autoIndent() {
    DOM.toast('代码已自动缩进', 'info');
    // 简单的自动缩进实现
    const lines = this.textarea.value.split('\n');
    let indentLevel = 0;
    const result = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { result.push(''); continue; }

      // 减少缩进的字符
      if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      result.push('  '.repeat(indentLevel) + trimmed);

      // 增加缩进的字符
      const openBrackets = (trimmed.match(/[\{\[\(]/g) || []).length;
      const closeBrackets = (trimmed.match(/[\}\]\)]/g) || []).length;
      indentLevel = Math.max(0, indentLevel + openBrackets - closeBrackets);
    }

    this.textarea.value = result.join('\n');
    this._handleInput();
  }

  /**
   * 更新语法高亮
   */
  _updateHighlight() {
    const code = this.textarea.value;
    window.highlightService.highlight(this.highlightLayer, code, this._language);
  }

  /**
   * 更新行号
   */
  _updateLineNumbers() {
    const lines = this.textarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) {
      html += i + '\n';
    }
    this.lineNumbers.textContent = html;
  }

  /**
   * 同步滚动
   */
  _syncScroll() {
    this.highlightLayer.scrollTop = this.textarea.scrollTop;
    this.highlightLayer.scrollLeft = this.textarea.scrollLeft;
    this.lineNumbers.scrollTop = this.textarea.scrollTop;
  }

  /**
   * 更新光标位置
   */
  _updateCursor() {
    if (!this.panel.classList.contains('active')) return;

    const pos = this.textarea.selectionStart;
    const textBefore = this.textarea.value.substring(0, pos);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    window.eventBus.emit(EVENTS.CURSOR_CHANGED, { line, col });
  }

  /**
   * 选中指定范围
   */
  selectRange(start, end) {
    this.textarea.focus();
    this.textarea.setSelectionRange(start, end);
  }

  /**
   * 获取选中文本
   */
  getSelectedText() {
    return this.textarea.value.substring(
      this.textarea.selectionStart,
      this.textarea.selectionEnd
    );
  }
}

// 全局单例
window.codeEditor = new CodeEditor();
