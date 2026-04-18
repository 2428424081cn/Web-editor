/* ============================================
   FindReplace - 查找替换组件
   ============================================ */

class FindReplace {
  constructor() {
    this.bar = document.getElementById('findReplaceBar');
    this.findInput = document.getElementById('findInput');
    this.replaceInput = document.getElementById('replaceInput');
    this.findCount = document.getElementById('findCount');
    this.caseSensitive = document.getElementById('findCaseSensitive');
    this.useRegex = document.getElementById('findRegex');
    this._isOpen = false;
    this._init();
  }

  _init() {
    // 查找输入
    this.findInput.addEventListener('input', () => this._doSearch());
    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) this._findPrev();
        else this._findNext();
      }
      if (e.key === 'Escape') this.close();
    });

    // 替换输入
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    // 选项变化
    this.caseSensitive.addEventListener('change', () => this._doSearch());
    this.useRegex.addEventListener('change', () => this._doSearch());

    // 按钮
    document.getElementById('findNext').addEventListener('click', () => this._findNext());
    document.getElementById('findPrev').addEventListener('click', () => this._findPrev());
    document.getElementById('findClose').addEventListener('click', () => this.close());
    document.getElementById('replaceOne').addEventListener('click', () => this._replaceOne());
    document.getElementById('replaceAll').addEventListener('click', () => this._replaceAll());

    // 监听事件
    window.eventBus.on(EVENTS.FIND_OPEN, () => this.open());
    window.eventBus.on(EVENTS.FIND_CLOSE, () => this.close());
    window.eventBus.on(EVENTS.FIND_NEXT, () => this._findNext());
    window.eventBus.on(EVENTS.FIND_PREV, () => this._findPrev());
    window.eventBus.on(EVENTS.FIND_RESULT, (result) => this._updateCount(result));

    // 内容变化时重新搜索
    window.eventBus.on(EVENTS.CONTENT_CHANGED, () => {
      if (this._isOpen && this.findInput.value) {
        this._doSearch();
      }
    });
  }

  /**
   * 打开查找栏
   */
  open() {
    this._isOpen = true;
    this.bar.style.display = '';
    this.findInput.focus();

    // 如果有选中文本，填入查找框
    const selected = this._getSelectedText();
    if (selected) {
      this.findInput.value = selected;
      this._doSearch();
    }
  }

  /**
   * 关闭查找栏
   */
  close() {
    this._isOpen = false;
    this.bar.style.display = 'none';
    window.searchService.search('', '');
  }

  /**
   * 执行搜索
   */
  _doSearch() {
    const query = this.findInput.value;
    const text = this._getFullText();
    const options = {
      caseSensitive: this.caseSensitive.checked,
      useRegex: this.useRegex.checked
    };
    window.searchService.search(text, query, options);
  }

  /**
   * 查找下一个
   */
  _findNext() {
    const match = window.searchService.findNext();
    if (match) {
      this._selectMatch(match);
    }
  }

  /**
   * 查找上一个
   */
  _findPrev() {
    const match = window.searchService.findPrev();
    if (match) {
      this._selectMatch(match);
    }
  }

  /**
   * 替换当前
   */
  _replaceOne() {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return;

    const replacement = this.replaceInput.value;
    const mode = tab.mode;

    if (mode === 'rich-text') {
      const match = window.searchService.getCurrentMatch();
      if (!match) return;
      const text = window.richTextEditor.getFullText();
      const result = window.searchService.replaceCurrent(text, replacement);
      if (result.replaced) {
        window.richTextEditor.selectRange(match.start, match.end);
        document.execCommand('insertText', false, replacement);
      }
    } else if (mode === 'code') {
      const text = window.codeEditor.getContent();
      const result = window.searchService.replaceCurrent(text, replacement);
      if (result.replaced) {
        window.codeEditor.setContent(result.text);
      }
    } else if (mode === 'markdown') {
      const text = window.markdownEditor.getContent();
      const result = window.searchService.replaceCurrent(text, replacement);
      if (result.replaced) {
        window.markdownEditor.setContent(result.text);
      }
    }

    this._doSearch();
  }

  /**
   * 替换全部
   */
  _replaceAll() {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return;

    const replacement = this.replaceInput.value;
    const mode = tab.mode;

    if (mode === 'code') {
      const text = window.codeEditor.getContent();
      const result = window.searchService.replaceAll(text, replacement);
      if (result.count > 0) {
        window.codeEditor.setContent(result.text);
        DOM.toast(`已替换 ${result.count} 处`, 'success');
      }
    } else if (mode === 'markdown') {
      const text = window.markdownEditor.getContent();
      const result = window.searchService.replaceAll(text, replacement);
      if (result.count > 0) {
        window.markdownEditor.setContent(result.text);
        DOM.toast(`已替换 ${result.count} 处`, 'success');
      }
    } else if (mode === 'rich-text') {
      DOM.toast('富文本模式暂不支持全部替换', 'warning');
    }

    this._doSearch();
  }

  /**
   * 选中匹配项
   */
  _selectMatch(match) {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return;

    if (tab.mode === 'rich-text') {
      window.richTextEditor.selectRange(match.start, match.end);
    } else if (tab.mode === 'code') {
      window.codeEditor.selectRange(match.start, match.end);
    } else if (tab.mode === 'markdown') {
      window.markdownEditor.selectRange(match.start, match.end);
    }
  }

  /**
   * 更新匹配计数
   */
  _updateCount(result) {
    if (result.total === 0) {
      this.findCount.textContent = this.findInput.value ? '无结果' : '';
    } else {
      this.findCount.textContent = `${result.current}/${result.total}`;
    }
  }

  /**
   * 获取当前编辑器全文
   */
  _getFullText() {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return '';

    if (tab.mode === 'rich-text') return window.richTextEditor.getFullText();
    if (tab.mode === 'code') return window.codeEditor.getContent();
    if (tab.mode === 'markdown') return window.markdownEditor.getContent();
    return '';
  }

  /**
   * 获取选中文本
   */
  _getSelectedText() {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return '';

    if (tab.mode === 'rich-text') {
      const sel = window.getSelection();
      return sel.toString();
    }
    if (tab.mode === 'code') return window.codeEditor.getSelectedText();
    if (tab.mode === 'markdown') return window.markdownEditor.getSelectedText();
    return '';
  }
}

// 全局单例
window.findReplace = new FindReplace();
