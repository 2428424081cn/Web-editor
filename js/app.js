/* ============================================
   App - 应用入口
   ============================================ */

class App {
  constructor() {
    this._init = this._initialize.bind(this);
  }

  async _initialize() {
    try {
      // 1. 初始化存储
      await window.storage.init();

      // 2. 初始化插件系统（必须在其他组件之前）
      window.pluginManager.init();

      // 3. 初始化主题
      await window.themeService.init();

      // 4. 初始化快捷键
      this._initShortcuts();

      // 5. 初始化菜单
      this._initMenus();

      // 6. 初始化模态框
      this._initModals();

      // 7. 初始化操作处理
      this._initActions();

      // 8. 初始化拖放
      this._initDragDrop();

      // 9. 初始化 Word 兼容服务（内置插件）
      await window.wordService.init();

      // 10. 激活示例插件
      await window.pluginManager.activate('word-count');
      await window.pluginManager.activate('timestamp');

      // 11. 恢复标签页或创建默认标签
      await this._restoreTabs();

      console.log('[App] Web 文本编辑器初始化完成（含插件系统）');
    } catch (err) {
      console.error('[App] 初始化失败:', err);
      DOM.toast('编辑器初始化失败', 'error');
    }
  }

  /**
   * 初始化快捷键
   */
  _initShortcuts() {
    const kb = window.keyboard;

    // 文件操作
    kb.register('mod+n', () => window.eventBus.emit(EVENTS.ACTION, 'new-file'));
    kb.register('mod+o', () => window.eventBus.emit(EVENTS.ACTION, 'open-file'));
    kb.register('mod+s', () => window.eventBus.emit(EVENTS.ACTION, 'save'));
    kb.register('mod+shift+s', () => window.eventBus.emit(EVENTS.ACTION, 'save-as'));
    kb.register('mod+w', () => window.eventBus.emit(EVENTS.ACTION, 'close-tab'));

    // 编辑操作
    kb.register('mod+z', () => window.eventBus.emit(EVENTS.UNDO));
    kb.register('mod+y', () => window.eventBus.emit(EVENTS.REDO));
    kb.register('mod+f', () => window.eventBus.emit(EVENTS.FIND_OPEN));
    kb.register('mod+h', () => window.eventBus.emit(EVENTS.ACTION, 'replace'));
    kb.register('f3', () => window.eventBus.emit(EVENTS.FIND_NEXT));
    kb.register('shift+f3', () => window.eventBus.emit(EVENTS.FIND_PREV));
    kb.register('escape', () => window.eventBus.emit(EVENTS.FIND_CLOSE));

    // 标签切换
    kb.register('mod+tab', () => this._switchToNextTab());
    kb.register('mod+shift+tab', () => this._switchToPrevTab());

    // 视图
    kb.register('mod+shift+t', () => window.eventBus.emit(EVENTS.ACTION, 'toggle-theme'));
    kb.register('mod+\\', () => window.eventBus.emit(EVENTS.ACTION, 'split-horizontal'));

    // 富文本格式化（允许在 contenteditable 中触发）
    kb.register('mod+b', () => window.eventBus.emit(EVENTS.FORMAT_APPLIED, 'bold'), { allowInInput: true });
    kb.register('mod+i', () => window.eventBus.emit(EVENTS.FORMAT_APPLIED, 'italic'), { allowInInput: true });
    kb.register('mod+u', () => window.eventBus.emit(EVENTS.FORMAT_APPLIED, 'underline'), { allowInInput: true });

    kb.init();
  }

  /**
   * 初始化菜单系统
   */
  _initMenus() {
    const menuBar = document.getElementById('menuBar');
    let activeMenu = null;

    // 点击菜单项
    menuBar.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeMenu === item) {
          item.classList.remove('active');
          activeMenu = null;
        } else {
          if (activeMenu) activeMenu.classList.remove('active');
          item.classList.add('active');
          activeMenu = item;
        }
      });

      // 鼠标进入切换
      item.addEventListener('mouseenter', () => {
        if (activeMenu && activeMenu !== item) {
          activeMenu.classList.remove('active');
          item.classList.add('active');
          activeMenu = item;
        }
      });
    });

    // 点击菜单项中的按钮
    menuBar.querySelectorAll('.dropdown-menu button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action) {
          window.eventBus.emit(EVENTS.ACTION, action);
        }
        if (activeMenu) {
          activeMenu.classList.remove('active');
          activeMenu = null;
        }
      });
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', () => {
      if (activeMenu) {
        activeMenu.classList.remove('active');
        activeMenu = null;
      }
    });
  }

  /**
   * 初始化模态框
   */
  _initModals() {
    // 关闭按钮
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        document.getElementById(modalId).style.display = 'none';
      });
    });

    // 点击遮罩关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
        }
      });
    });

    // 插入链接确认
    document.getElementById('linkConfirm').addEventListener('click', () => {
      const url = document.getElementById('linkUrl').value;
      if (url) {
        window.richTextEditor.insertLink(url);
      }
      document.getElementById('linkModal').style.display = 'none';
      document.getElementById('linkUrl').value = '';
    });

    // ESC 关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
      }
    });
  }

  /**
   * 初始化操作处理
   */
  _initActions() {
    window.eventBus.on(EVENTS.ACTION, (action) => {
      if (typeof action === 'string') {
        this._handleAction(action);
      } else if (action && typeof action === 'object') {
        this._handleAction(action.type, action);
      }
    });

    // 监听模式切换
    window.eventBus.on(EVENTS.EDITOR_MODE_CHANGED, (mode) => {
      const tab = window.tabManager.getActiveTab();
      if (tab) {
        // 保存当前内容
        this._saveTabContent(tab);

        // 切换面板
        window.richTextEditor.hide();
        window.codeEditor.hide();
        window.markdownEditor.hide();

        if (mode === 'rich-text') window.richTextEditor.show();
        else if (mode === 'code') window.codeEditor.show();
        else if (mode === 'markdown') window.markdownEditor.show();

        // 更新标签模式
        window.tabManager.updateTab(tab.id, { mode });
      }
    });

    // 监听撤销/重做
    window.eventBus.on(EVENTS.UNDO, () => {
      const tab = window.tabManager.getActiveTab();
      if (!tab) return;
      const state = window.historyManager.undo();
      if (state && state.content !== undefined) {
        if (tab.mode === 'rich-text') {
          window.richTextEditor.setContent(state.content);
        } else if (tab.mode === 'code') {
          window.codeEditor.setContent(state.content);
        } else if (tab.mode === 'markdown') {
          window.markdownEditor.setContent(state.content);
        }
      }
    });

    window.eventBus.on(EVENTS.REDO, () => {
      const tab = window.tabManager.getActiveTab();
      if (!tab) return;
      const state = window.historyManager.redo();
      if (state && state.content !== undefined) {
        if (tab.mode === 'rich-text') {
          window.richTextEditor.setContent(state.content);
        } else if (tab.mode === 'code') {
          window.codeEditor.setContent(state.content);
        } else if (tab.mode === 'markdown') {
          window.markdownEditor.setContent(state.content);
        }
      }
    });
  }

  /**
   * 处理操作
   */
  _handleAction(action, data) {
    const tab = window.tabManager.getActiveTab();

    switch (action) {
      case 'new-file':
        window.tabManager.createTab();
        break;

      case 'open-file':
        if (tab) window.fileService.openFile(tab.id);
        break;

      case 'save':
        if (tab) {
          const content = this._getTabContent(tab);
          window.fileService.saveFile(tab.id, content, tab.title);
        }
        break;

      case 'save-as':
        if (tab) {
          const content = this._getTabContent(tab);
          window.fileService.saveAs(tab.id, content, tab.title);
        }
        break;

      case 'close-tab':
        if (tab) window.tabManager.closeTab(tab.id);
        break;

      case 'find':
        window.eventBus.emit(EVENTS.FIND_OPEN);
        break;

      case 'replace':
        window.eventBus.emit(EVENTS.FIND_OPEN);
        setTimeout(() => document.getElementById('replaceInput').focus(), 100);
        break;

      case 'toggle-theme':
        window.themeService.toggle();
        break;

      case 'split-horizontal':
        this._toggleSplit('horizontal');
        break;

      case 'split-vertical':
        this._toggleSplit('vertical');
        break;

      case 'insert-link':
        document.getElementById('linkModal').style.display = '';
        setTimeout(() => document.getElementById('linkUrl').focus(), 100);
        break;

      case 'insert-image':
        this._insertImage();
        break;

      case 'about':
        document.getElementById('aboutModal').style.display = '';
        break;

      case 'shortcuts':
        document.getElementById('shortcutsModal').style.display = '';
        break;

      case 'zoom-in':
        document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1).toFixed(1);
        break;

      case 'zoom-out':
        document.body.style.zoom = Math.max(0.5, (parseFloat(document.body.style.zoom || 1) - 0.1)).toFixed(1);
        break;

      case 'zoom-reset':
        document.body.style.zoom = '';
        break;

      case 'cut':
        document.execCommand('cut');
        break;

      case 'copy':
        document.execCommand('copy');
        break;

      case 'paste':
        document.execCommand('paste');
        break;
    }
  }

  /**
   * 初始化拖放
   */
  _initDragDrop() {
    const editorArea = document.getElementById('editorArea');

    editorArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    editorArea.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        for (const file of files) {
          const content = await file.text();
          const ext = DOM.getFileExtension(file.name);
          const mode = DOM.getModeFromExtension(ext);
          const lang = DOM.getLangFromExtension(ext);
          window.tabManager.createTab({
            title: file.name,
            content,
            mode,
            language: lang,
            filePath: file.name
          });
        }
      }
    });
  }

  /**
   * 恢复标签页
   */
  async _restoreTabs() {
    const tabs = await window.storage.getAllTabs();
    if (tabs && tabs.length > 0) {
      // 按 order 排序
      tabs.sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const tab of tabs) {
        window.tabManager.createTab({
          title: tab.title,
          mode: tab.mode,
          content: tab.content,
          language: tab.language
        });
      }
    } else {
      // 创建默认欢迎标签
      window.tabManager.createTab({
        title: '欢迎.txt',
        mode: 'rich-text',
        content: `<h1>欢迎使用 Web 文本编辑器</h1>
<p>这是一个基于纯原生 Vanilla JS 构建的全功能文本编辑器。</p>
<h2>功能特性</h2>
<ul>
<li><strong>富文本编辑</strong> — 加粗、斜体、下划线、列表、插入图片和链接</li>
<li><strong>代码编辑</strong> — 语法高亮、行号显示、自动缩进、括号匹配</li>
<li><strong>Markdown 编辑</strong> — 实时预览、GFM 支持、工具栏快捷操作</li>
<li><strong>多标签页</strong> — 拖拽排序、状态持久化</li>
<li><strong>文件操作</strong> — 新建、打开、保存、另存为、拖放导入</li>
<li><strong>查找替换</strong> — 支持正则表达式、区分大小写</li>
<li><strong>主题切换</strong> — 亮色/暗色主题</li>
</ul>
<h2>快捷键</h2>
<p>按 <strong>Ctrl+Shift+T</strong> 切换主题，<strong>Ctrl+N</strong> 新建文件，<strong>Ctrl+O</strong> 打开文件。</p>
<p>查看完整快捷键列表请点击菜单栏 <em>帮助 → 快捷键列表</em>。</p>`
      });
    }
  }

  /**
   * 获取标签页内容
   */
  _getTabContent(tab) {
    if (tab.mode === 'rich-text') return window.richTextEditor.getContent();
    if (tab.mode === 'code') return window.codeEditor.getContent();
    if (tab.mode === 'markdown') return window.markdownEditor.getContent();
    return '';
  }

  /**
   * 保存标签页内容
   */
  _saveTabContent(tab) {
    tab.content = this._getTabContent(tab);
    window.storage.saveTab(tab);
  }

  /**
   * 切换到下一个标签
   */
  _switchToNextTab() {
    const tabs = window.tabManager.getAllTabs();
    if (tabs.length <= 1) return;
    const currentId = window.tabManager.activeTabId;
    const idx = tabs.findIndex(t => t.id === currentId);
    const nextIdx = (idx + 1) % tabs.length;
    window.tabManager.switchTab(tabs[nextIdx].id);
  }

  /**
   * 切换到上一个标签
   */
  _switchToPrevTab() {
    const tabs = window.tabManager.getAllTabs();
    if (tabs.length <= 1) return;
    const currentId = window.tabManager.activeTabId;
    const idx = tabs.findIndex(t => t.id === currentId);
    const prevIdx = (idx - 1 + tabs.length) % tabs.length;
    window.tabManager.switchTab(tabs[prevIdx].id);
  }

  /**
   * 分屏切换
   */
  _toggleSplit(direction) {
    const container = document.getElementById('editorContainer');
    container.classList.remove('split-horizontal', 'split-vertical');
    if (direction) {
      container.classList.add(`split-${direction}`);
    }
  }

  /**
   * 插入图片
   */
  _insertImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        window.richTextEditor.insertImage(reader.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app._initialize();
});
