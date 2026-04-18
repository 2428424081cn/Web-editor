/* ============================================
   MarkdownEditor - Markdown 编辑器组件
   ============================================ */

class MarkdownEditor {
  constructor() {
    this.textarea = document.getElementById('markdownTextarea');
    this.previewContent = document.getElementById('markdownPreviewContent');
    this.panel = document.getElementById('markdownPanel');
    this.splitDivider = document.getElementById('splitDivider');
    this._markedLoaded = false;
    this._previewVisible = true;
    this._init();
  }

  async _init() {
    // 加载 marked.js
    await this._loadMarked();

    // 输入事件 - 实时预览
    this.textarea.addEventListener('input', () => this._handleInput());
    this.textarea.addEventListener('keydown', (e) => this._handleKeyDown(e));
    this.textarea.addEventListener('click', () => this._updateCursor());
    this.textarea.addEventListener('keyup', () => this._updateCursor());

    // Tab 键
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
      }
    });

    // 分割线拖拽
    this._initSplitDivider();

    // 监听 Markdown 工具栏操作
    window.eventBus.on(EVENTS.ACTION, (action) => {
      if (action && action.type === 'md-insert') {
        this._insertMarkdown(action.format);
      }
      if (action === 'toggle-preview') {
        this.togglePreview();
      }
    });

    // 监听标签切换
    window.eventBus.on(EVENTS.TAB_SWITCHED, (tab) => {
      if (tab.mode === 'markdown') {
        this.show();
        this.setContent(tab.content || '');
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
   * 加载 marked.js
   */
  async _loadMarked() {
    if (window.marked) {
      this._markedLoaded = true;
      return;
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'lib/marked.min.js';
      script.onload = () => {
        this._markedLoaded = true;
        // 配置 marked
        if (window.marked) {
          marked.setOptions({
            breaks: true,
            gfm: true,
          });
        }
        resolve();
      };
      script.onerror = () => {
        console.warn('[MarkdownEditor] Failed to load marked.js, preview disabled');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 显示编辑器
   */
  show() {
    this.panel.classList.add('active');
    this.textarea.focus();
    this._updatePreview();
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
  setContent(md) {
    this.textarea.value = md || '';
    this._updatePreview();
    window.historyManager.clear();
  }

  /**
   * 切换预览
   */
  togglePreview() {
    this._previewVisible = !this._previewVisible;
    const previewSide = document.getElementById('markdownPreview');
    const divider = document.getElementById('splitDivider');
    previewSide.style.display = this._previewVisible ? '' : 'none';
    divider.style.display = this._previewVisible ? '' : 'none';
  }

  /**
   * 处理输入
   */
  _handleInput() {
    this._debouncedPreview();

    const tab = window.tabManager.getActiveTab();
    if (tab) {
      window.tabManager.updateTab(tab.id, { dirty: true });
    }

    window.eventBus.emit(EVENTS.CONTENT_CHANGED, {
      mode: 'markdown',
      content: this.textarea.value
    });
  }

  /**
   * 更新预览（节流）
   */
  _debouncedPreview = DOM.debounce(() => {
    this._updatePreview();
  }, 150);

  /**
   * 更新预览
   */
  _updatePreview() {
    if (!this._markedLoaded || !window.marked) return;

    const md = this.textarea.value;
    try {
      this.previewContent.innerHTML = marked.parse(md);
    } catch (err) {
      this.previewContent.innerHTML = `<p style="color:var(--error)">Markdown 解析错误: ${err.message}</p>`;
    }
  }

  /**
   * 处理键盘事件
   */
  _handleKeyDown(e) {
    // 快捷 Markdown 操作
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          this._wrapSelection('**', '**');
          break;
        case 'i':
          e.preventDefault();
          this._wrapSelection('*', '*');
          break;
      }
    }
  }

  /**
   * 插入 Markdown 语法
   */
  _insertMarkdown(format) {
    this.textarea.focus();
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selected = this.textarea.value.substring(start, end);
    let before = '', after = '', newText = '';

    switch (format) {
      case 'heading':
        before = '## ';
        newText = before + (selected || '标题');
        break;
      case 'bold':
        before = '**'; after = '**';
        newText = before + (selected || '粗体文本') + after;
        break;
      case 'italic':
        before = '*'; after = '*';
        newText = before + (selected || '斜体文本') + after;
        break;
      case 'code':
        if (selected && selected.includes('\n')) {
          before = '```\n'; after = '\n```';
        } else {
          before = '`'; after = '`';
        }
        newText = before + (selected || '代码') + after;
        break;
      case 'link':
        newText = `[${selected || '链接文本'}](url)`;
        break;
      case 'image':
        newText = `![${selected || '图片描述'}](url)`;
        break;
      case 'list':
        newText = '- ' + (selected || '列表项');
        break;
      case 'table':
        newText = '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |';
        break;
    }

    document.execCommand('insertText', false, newText);
    this._handleInput();
  }

  /**
   * 包裹选中文本
   */
  _wrapSelection(before, after) {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selected = this.textarea.value.substring(start, end) || '文本';
    const newText = before + selected + after;
    document.execCommand('insertText', false, newText);
    this._handleInput();
  }

  /**
   * 初始化分割线拖拽
   */
  _initSplitDivider() {
    let isDragging = false;

    this.splitDivider.addEventListener('mousedown', (e) => {
      isDragging = true;
      this.splitDivider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const container = document.getElementById('markdownSplit');
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const clamped = Math.max(0.2, Math.min(0.8, ratio));

      const editorSide = document.querySelector('.markdown-editor-side');
      const previewSide = document.getElementById('markdownPreview');
      editorSide.style.flex = `0 0 ${clamped * 100}%`;
      previewSide.style.flex = `0 0 ${(1 - clamped) * 100}%`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.splitDivider.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
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
window.markdownEditor = new MarkdownEditor();
