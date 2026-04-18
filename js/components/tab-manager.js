/* ============================================
   TabManager - 标签页管理器
   ============================================ */

class TabManager {
  constructor() {
    this.tabs = new Map();
    this.activeTabId = null;
    this._tabCounter = 0;
    this._tabListEl = document.getElementById('tabList');
    this._tabNewBtn = document.getElementById('tabNew');
    this._draggedTabId = null;
    this._init();
  }

  _init() {
    // 新建标签按钮
    this._tabNewBtn.addEventListener('click', () => this.createTab());

    // 标签栏事件委托
    this._tabListEl.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.tab-close');
      if (closeBtn) {
        e.stopPropagation();
        const tabEl = closeBtn.closest('.tab');
        if (tabEl) this.closeTab(tabEl.dataset.tabId);
        return;
      }

      const tabEl = e.target.closest('.tab');
      if (tabEl) {
        this.switchTab(tabEl.dataset.tabId);
      }
    });

    // 拖拽排序
    this._tabListEl.addEventListener('dragstart', (e) => {
      const tabEl = e.target.closest('.tab');
      if (!tabEl) return;
      this._draggedTabId = tabEl.dataset.tabId;
      tabEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    this._tabListEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const tabEl = e.target.closest('.tab');
      if (tabEl && tabEl.dataset.tabId !== this._draggedTabId) {
        const rect = tabEl.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (e.clientX < midX) {
          this._tabListEl.insertBefore(this._tabListEl.querySelector('.dragging'), tabEl);
        } else {
          this._tabListEl.insertBefore(this._tabListEl.querySelector('.dragging'), tabEl.nextSibling);
        }
      }
    });

    this._tabListEl.addEventListener('dragend', () => {
      this._draggedTabId = null;
      this._tabListEl.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    });

    // 监听文件打开事件
    window.eventBus.on(EVENTS.FILE_OPENED, ({ tabId, fileName, content, isNew }) => {
      this.updateTab(tabId, { title: fileName, dirty: false });
    });

    window.eventBus.on(EVENTS.FILE_SAVED, ({ fileName }) => {
      if (this.activeTabId && fileName) {
        this.updateTab(this.activeTabId, { title: fileName, dirty: false });
      }
    });
  }

  /**
   * 创建新标签页
   */
  createTab(options = {}) {
    const id = 'tab-' + (++this._tabCounter);
    const tab = {
      id,
      title: options.title || '未命名.txt',
      mode: options.mode || 'rich-text',
      content: options.content || '',
      dirty: false,
      filePath: options.filePath || null,
      language: options.language || 'javascript',
      createdAt: Date.now()
    };

    this.tabs.set(id, tab);
    this._renderTab(tab);
    this.switchTab(id);

    window.eventBus.emit(EVENTS.TAB_CREATED, tab);
    window.historyManager.setTab(id);
    window.historyManager.clear();

    return id;
  }

  /**
   * 关闭标签页
   */
  closeTab(tabId) {
    if (!this.tabs.has(tabId)) return;

    const tab = this.tabs.get(tabId);

    // 移除 DOM
    const tabEl = this._tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.remove();

    this.tabs.delete(tabId);
    window.fileService.removeHandle(tabId);
    window.storage.deleteTab(tabId);

    // 如果关闭的是当前标签，切换到相邻标签
    if (this.activeTabId === tabId) {
      const remaining = [...this.tabs.keys()];
      if (remaining.length > 0) {
        // 切换到最近的标签
        const idx = remaining.indexOf(tabId);
        const nextId = remaining[Math.min(idx, remaining.length - 1)];
        this.switchTab(nextId);
      } else {
        // 没有标签了，创建一个新的
        this.createTab();
      }
    }

    window.eventBus.emit(EVENTS.TAB_CLOSED, { id: tabId, tab });
  }

  /**
   * 切换标签页
   */
  switchTab(tabId) {
    if (!this.tabs.has(tabId)) return;

    // 保存当前标签内容
    if (this.activeTabId) {
      this._saveCurrentContent();
    }

    this.activeTabId = tabId;

    // 更新 UI
    this._tabListEl.querySelectorAll('.tab').forEach(el => {
      DOM.toggleClass(el, 'active', el.dataset.tabId === tabId);
    });

    const tab = this.tabs.get(tabId);
    window.historyManager.setTab(tabId);
    window.eventBus.emit(EVENTS.TAB_SWITCHED, tab);
  }

  /**
   * 更新标签页数据
   */
  updateTab(tabId, updates) {
    if (!this.tabs.has(tabId)) return;

    const tab = this.tabs.get(tabId);
    Object.assign(tab, updates);
    this.tabs.set(tabId, tab);

    // 更新 DOM
    const tabEl = this._tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) {
      const titleEl = tabEl.querySelector('.tab-title');
      if (titleEl && updates.title !== undefined) titleEl.textContent = updates.title;
      DOM.toggleClass(tabEl, 'dirty', tab.dirty);
    }

    // 持久化
    window.storage.saveTab(tab);

    window.eventBus.emit(EVENTS.TAB_UPDATED, tab);
  }

  /**
   * 获取当前活动标签
   */
  getActiveTab() {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : null;
  }

  /**
   * 获取所有标签
   */
  getAllTabs() {
    return [...this.tabs.values()];
  }

  /**
   * 渲染标签页 DOM
   */
  _renderTab(tab) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === this.activeTabId ? ' active' : '');
    el.dataset.tabId = tab.id;
    el.draggable = true;
    el.innerHTML = `
      <span class="tab-title">${this._escapeHtml(tab.title)}</span>
      <button class="tab-close">&times;</button>
    `;
    this._tabListEl.appendChild(el);
  }

  /**
   * 保存当前标签页内容
   */
  _saveCurrentContent() {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) return;

    // 获取当前编辑器内容
    const mode = tab.mode;
    let content = '';
    if (mode === 'rich-text') {
      const editor = document.getElementById('richTextEditor');
      content = editor ? editor.innerHTML : '';
    } else if (mode === 'code') {
      const textarea = document.getElementById('codeTextarea');
      content = textarea ? textarea.value : '';
    } else if (mode === 'markdown') {
      const textarea = document.getElementById('markdownTextarea');
      content = textarea ? textarea.value : '';
    }

    tab.content = content;
    window.storage.saveTab(tab);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 全局单例
window.tabManager = new TabManager();
