/* ============================================
   RichTextEditor - 富文本编辑器组件
   ============================================ */

class RichTextEditor {
  constructor() {
    this.editor = document.getElementById('richTextEditor');
    this.panel = document.getElementById('richTextPanel');
    this._isComposing = false;
    this._lastContent = '';
    this._init();
  }

  _init() {
    // 输入事件
    this.editor.addEventListener('beforeinput', (e) => this._handleBeforeInput(e));
    this.editor.addEventListener('input', () => this._handleInput());

    // IME 输入法
    this.editor.addEventListener('compositionstart', () => { this._isComposing = true; });
    this.editor.addEventListener('compositionend', () => {
      this._isComposing = false;
      this._handleInput();
    });

    // 选区变化
    document.addEventListener('selectionchange', () => this._updateToolbarState());

    // 光标位置更新
    this.editor.addEventListener('keyup', () => this._updateCursor());
    this.editor.addEventListener('mouseup', () => this._updateCursor());

    // 粘贴事件 - 清理格式
    this.editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    // 拖放文件
    this.editor.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        e.preventDefault();
        // 可以处理文件拖放
      }
    });

    // 监听格式化事件
    window.eventBus.on(EVENTS.FORMAT_APPLIED, (format) => this._applyFormat(format));

    // 监听标签切换
    window.eventBus.on(EVENTS.TAB_SWITCHED, (tab) => {
      if (tab.mode === 'rich-text') {
        this.show();
        this.setContent(tab.content);
      }
    });
  }

  /**
   * 显示编辑器
   */
  show() {
    this.panel.classList.add('active');
    this.editor.focus();
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
    return this.editor.innerHTML;
  }

  /**
   * 获取纯文本
   */
  getText() {
    return this.editor.innerText;
  }

  /**
   * 设置内容
   */
  setContent(html) {
    this.editor.innerHTML = html || '';
    this._lastContent = html || '';
    window.historyManager.clear();
  }

  /**
   * 处理 beforeinput 事件
   */
  _handleBeforeInput(e) {
    if (this._isComposing) return;

    // 记录撤销快照
    const content = this.editor.innerHTML;
    if (content !== this._lastContent) {
      window.historyManager.pushSnapshot(this._lastContent);
      this._lastContent = content;
    }
  }

  /**
   * 处理 input 事件
   */
  _handleInput() {
    if (this._isComposing) return;

    const tab = window.tabManager.getActiveTab();
    if (tab) {
      window.tabManager.updateTab(tab.id, { dirty: true });
    }

    window.eventBus.emit(EVENTS.CONTENT_CHANGED, {
      mode: 'rich-text',
      content: this.editor.innerHTML
    });
  }

  /**
   * 应用格式
   */
  _applyFormat(format) {
    this.editor.focus();

    switch (format) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'underline':
        document.execCommand('underline', false, null);
        break;
      case 'strikeThrough':
        document.execCommand('strikeThrough', false, null);
        break;
      case 'insertUnorderedList':
        document.execCommand('insertUnorderedList', false, null);
        break;
      case 'insertOrderedList':
        document.execCommand('insertOrderedList', false, null);
        break;
      case 'justifyLeft':
        document.execCommand('justifyLeft', false, null);
        break;
      case 'justifyCenter':
        document.execCommand('justifyCenter', false, null);
        break;
      case 'justifyRight':
        document.execCommand('justifyRight', false, null);
        break;
      default:
        document.execCommand(format, false, null);
    }

    this._updateToolbarState();
    this._handleInput();
  }

  /**
   * 插入链接
   */
  insertLink(url) {
    this.editor.focus();
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      document.execCommand('createLink', false, url);
    } else {
      const link = `<a href="${url}" target="_blank">${url}</a>`;
      document.execCommand('insertHTML', false, link);
    }
    this._handleInput();
  }

  /**
   * 插入图片
   */
  insertImage(url) {
    this.editor.focus();
    const img = `<img src="${url}" alt="image" style="max-width:100%">`;
    document.execCommand('insertHTML', false, img);
    this._handleInput();
  }

  /**
   * 更新工具栏状态
   */
  _updateToolbarState() {
    if (this.panel.classList.contains('active')) {
      window.toolbar.updateFormatState('bold', document.queryCommandState('bold'));
      window.toolbar.updateFormatState('italic', document.queryCommandState('italic'));
      window.toolbar.updateFormatState('underline', document.queryCommandState('underline'));
      window.toolbar.updateFormatState('strikeThrough', document.queryCommandState('strikeThrough'));
    }
  }

  /**
   * 更新光标位置
   */
  _updateCursor() {
    if (!this.panel.classList.contains('active')) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(this.editor);
    preRange.setEnd(range.startContainer, range.startOffset);
    const textBefore = preRange.toString();

    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    window.eventBus.emit(EVENTS.CURSOR_CHANGED, { line, col });
  }

  /**
   * 获取全文（用于查找替换）
   */
  getFullText() {
    return this.editor.innerText;
  }

  /**
   * 选中指定范围
   */
  selectRange(start, end) {
    const textNodes = this._getTextNodes();
    let currentPos = 0;

    for (const node of textNodes) {
      const nodeLength = node.textContent.length;
      if (currentPos + nodeLength >= start) {
        const range = document.createRange();
        range.setStart(node, start - currentPos);
        range.setEnd(node, Math.min(end - currentPos, nodeLength));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      currentPos += nodeLength;
    }
  }

  _getTextNodes() {
    const walker = document.createTreeWalker(this.editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }
}

// 全局单例
window.richTextEditor = new RichTextEditor();
