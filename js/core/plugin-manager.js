/* ============================================
   PluginManager - 轻量插件管理系统（增强版）
   ============================================
   
   支持：运行时安装/卸载/启用/禁用，URL 远程安装，持久化状态
   ============================================ */

class PluginManager {
  constructor() {
    this._plugins = new Map();
    this._api = null;
    this._hooks = new Map();
    this._toolbarSlots = new Map();
    this._menuSlots = new Map();
    this._editorModes = new Map();
    this._sidebarPanels = new Map();
    this._fileHandlers = new Map();
    this._loadedScripts = new Set();   // 已加载的脚本 URL
    this._loadedStyles = new Set();    // 已加载的样式 URL
    this._onChangeCallbacks = new Set(); // UI 刷新回调
  }

  /**
   * 注册 UI 刷新回调（供插件管理面板使用）
   */
  onUIChange(callback) {
    this._onChangeCallbacks.add(callback);
    return () => this._onChangeCallbacks.delete(callback);
  }

  _notifyUIChange() {
    this._onChangeCallbacks.forEach(cb => {
      try { cb(this.getAllPlugins()); } catch(e) {}
    });
  }

  /**
   * 初始化插件 API
   */
  init() {
    this._api = {
      // 编辑器访问
      editor: {
        getContent: () => this._getActiveContent(),
        setContent: (html) => this._setActiveContent(html),
        getText: () => this._getActiveText(),
        getMode: () => window.tabManager?.getActiveTab()?.mode,
        insertHTML: (html) => document.execCommand('insertHTML', false, html),
        insertText: (text) => document.execCommand('insertText', false, text),
        getSelection: () => {
          const sel = window.getSelection();
          return sel ? sel.toString() : '';
        },
        replaceSelection: (text) => {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) {
            document.execCommand('insertText', false, text);
          }
        },
      },
      // 事件系统
      on: (event, callback) => this.onHook(event, callback),
      off: (event, callback) => this.offHook(event, callback),
      emit: (event, data) => window.eventBus?.emit(event, data),
      once: (event, callback) => window.eventBus?.once(event, callback),
      // 标签页
      tabs: {
        getActive: () => window.tabManager?.getActiveTab(),
        getAll: () => window.tabManager?.getAllTabs() || [],
        create: (opts) => window.tabManager?.createTab(opts),
        close: (id) => window.tabManager?.closeTab(id),
        switchTo: (id) => window.tabManager?.switchTab(id),
      },
      // 主题
      theme: {
        get current() { return window.themeService?.current; },
        toggle: () => window.themeService?.toggle(),
        set: (t) => window.themeService?.setTheme(t),
      },
      // 存储（插件隔离命名空间）
      storage: {
        get: (key) => window.storage?.getSetting('plugin_' + key),
        set: (key, val) => window.storage?.saveSetting('plugin_' + key, val),
        remove: (key) => window.storage?.deleteSetting?.('plugin_' + key),
      },
      // UI 工具
      ui: {
        toast: (msg, type, dur) => DOM.toast(msg, type, dur),
        showModal: (id) => { const el = document.getElementById(id); if (el) el.style.display = ''; },
        hideModal: (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; },
        createElement: (tag, attrs, children) => DOM.create(tag, attrs, children),
      },
      // 注册扩展点
      register: {
        toolbar: (items) => this._registerToolbar(items),
        menu: (items) => this._registerMenu(items),
        editorMode: (mode) => this._registerEditorMode(mode),
        sidebar: (panel) => this._registerSidebar(panel),
        fileHandler: (handler) => this._registerFileHandler(handler),
        shortcut: (sc) => this._registerShortcut(sc),
      },
      // 注销扩展点
      unregister: {
        toolbar: (pluginName) => this._unregisterToolbar(pluginName),
        menu: (pluginName) => this._unregisterMenu(pluginName),
        editorMode: (pluginName) => this._unregisterEditorMode(pluginName),
        sidebar: (pluginName) => this._unregisterSidebar(pluginName),
        fileHandler: (pluginName) => this._unregisterFileHandler(pluginName),
      },
      // 元数据
      meta: {
        editorVersion: '1.0.0',
        apiVersion: '1.0.0',
      }
    };

    window.WebEditor = this._api;
  }

  // ========== 插件注册 ==========

  /**
   * 通过 JS API 注册插件
   */
  register(plugin) {
    if (!plugin || !plugin.name) {
      console.error('[PluginManager] Plugin must have a name');
      return false;
    }

    const existing = this._plugins.get(plugin.name);
    if (existing) {
      // 已存在则更新
      Object.assign(existing, plugin, { active: existing.active });
      this._notifyUIChange();
      return true;
    }

    const record = {
      name: plugin.name,
      displayName: plugin.displayName || plugin.name,
      version: plugin.version || '0.0.0',
      description: plugin.description || '',
      author: plugin.author || '',
      active: false,
      source: plugin.source || 'local',   // local | url | builtin
      scriptUrl: plugin.scriptUrl || null,
      styleUrl: plugin.styleUrl || null,
      // 生命周期
      activate: plugin.activate || null,
      deactivate: plugin.deactivate || null,
      // 扩展点定义（保留原始引用用于重激活）
      _toolbar: plugin.toolbar || null,
      _menu: plugin.menu || null,
      _editorModes: plugin.editorModes || null,
      _sidebar: plugin.sidebar || null,
      _fileHandlers: plugin.fileHandlers || null,
      _shortcuts: plugin.shortcuts || null,
      _hooks: plugin.hooks || null,
      registeredAt: Date.now()
    };

    this._plugins.set(plugin.name, record);
    this._savePluginStates();
    this._notifyUIChange();
    console.log(`[PluginManager] Registered: ${plugin.name} v${record.version}`);
    return true;
  }

  /**
   * 从 URL 安装插件（运行时）
   */
  async installFromUrl(url) {
    try {
      DOM.toast('正在安装插件...', 'info');

      // 加载脚本
      await this._loadScript(url, true);

      // 脚本应该通过 WebEditor.register() 自行注册
      // 等待一小段时间让脚本执行
      await new Promise(r => setTimeout(r, 100));

      // 检查是否有新插件注册
      const plugins = this.getAllPlugins();
      const newPlugin = plugins.find(p => p.scriptUrl === url && !p.active);

      if (newPlugin) {
        await this.activate(newPlugin.name);
        DOM.toast(`插件 "${newPlugin.displayName}" 安装成功`, 'success');
        return newPlugin;
      } else {
        DOM.toast('插件脚本未正确注册', 'warning');
        return null;
      }
    } catch (err) {
      console.error('[PluginManager] Install from URL failed:', err);
      DOM.toast('插件安装失败: ' + err.message, 'error');
      return null;
    }
  }

  /**
   * 从 JSON 配置安装
   */
  async installFromConfig(config) {
    if (!config.name || !config.script) {
      console.error('[PluginManager] Config must have name and script');
      return false;
    }

    if (config.style) await this._loadStyle(config.style);
    await this._loadScript(config.script, true);
    await new Promise(r => setTimeout(r, 100));

    const success = this._plugins.has(config.name);
    if (success) {
      const p = this._plugins.get(config.name);
      p.source = 'config';
      p.scriptUrl = config.script;
      p.styleUrl = config.style || null;
      await this.activate(config.name);
    }
    return success;
  }

  /**
   * 卸载插件（完全移除）
   */
  async uninstall(name) {
    const plugin = this._plugins.get(name);
    if (!plugin) return false;

    // 如果是内置插件，不允许卸载
    if (plugin.source === 'builtin') {
      DOM.toast('内置插件不允许卸载', 'warning');
      return false;
    }

    // 停用
    await this.deactivate(name);

    // 移除加载的脚本和样式
    if (plugin.scriptUrl) {
      this._removeScript(plugin.scriptUrl);
    }
    if (plugin.styleUrl) {
      this._removeStyle(plugin.styleUrl);
    }

    this._plugins.delete(name);
    this._savePluginStates();
    this._notifyUIChange();
    DOM.toast(`插件 "${plugin.displayName}" 已卸载`, 'success');
    console.log(`[PluginManager] Uninstalled: ${name}`);
    return true;
  }

  /**
   * 激活插件
   */
  async activate(name) {
    const plugin = this._plugins.get(name);
    if (!plugin) return false;
    if (plugin.active) return true;

    try {
      if (plugin._toolbar) this._registerToolbar(plugin._toolbar.map(t => ({ ...t, plugin: name })));
      if (plugin._menu) this._registerMenu(plugin._menu.map(m => ({ ...m, plugin: name })));
      if (plugin._editorModes) plugin._editorModes.forEach(m => this._registerEditorMode({ ...m, plugin: name }));
      if (plugin._sidebar) this._registerSidebar({ ...plugin._sidebar, plugin: name });
      if (plugin._fileHandlers) plugin._fileHandlers.forEach(h => this._registerFileHandler({ ...h, plugin: name }));
      if (plugin._shortcuts) plugin._shortcuts.forEach(s => this._registerShortcut({ ...s, plugin: name }));
      if (plugin._hooks) plugin._hooks.forEach(h => this.onHook(h.event, h.callback));

      if (plugin.activate) await plugin.activate(this._api);

      plugin.active = true;
      this._savePluginStates();
      this._notifyUIChange();
      window.eventBus?.emit('plugin:activated', { name });
      return true;
    } catch (err) {
      console.error(`[PluginManager] Activate failed "${name}":`, err);
      return false;
    }
  }

  /**
   * 停用插件（保留注册，可重新激活）
   */
  deactivate(name) {
    const plugin = this._plugins.get(name);
    if (!plugin || !plugin.active) return false;

    try {
      if (plugin.deactivate) plugin.deactivate();
      this._unregisterToolbar(name);
      this._unregisterMenu(name);
      this._unregisterEditorMode(name);
      this._unregisterSidebar(name);
      this._unregisterFileHandler(name);
      if (plugin._hooks) plugin._hooks.forEach(h => this.offHook(h.event, h.callback));

      plugin.active = false;
      this._savePluginStates();
      this._notifyUIChange();
      window.eventBus?.emit('plugin:deactivated', { name });
      return true;
    } catch (err) {
      console.error(`[PluginManager] Deactivate failed "${name}":`, err);
      return false;
    }
  }

  // ========== 查询 ==========

  getPlugin(name) { return this._plugins.get(name); }
  getAllPlugins() { return [...this._plugins.values()]; }
  isPluginActive(name) { return this._plugins.get(name)?.active || false; }

  // ========== 持久化 ==========

  async _savePluginStates() {
    const states = {};
    for (const [name, plugin] of this._plugins) {
      if (plugin.source === 'builtin') continue; // 内置插件不持久化
      states[name] = {
        active: plugin.active,
        source: plugin.source,
        scriptUrl: plugin.scriptUrl,
        styleUrl: plugin.styleUrl,
      };
    }
    await window.storage?.saveSetting('plugin_states', states);
  }

  async _restorePluginStates() {
    const states = await window.storage?.getSetting('plugin_states');
    if (!states) return;

    for (const [name, state] of Object.entries(states)) {
      if (state.scriptUrl && !this._plugins.has(name)) {
        try {
          await this._loadScript(state.scriptUrl, true);
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          console.warn(`[PluginManager] Failed to restore plugin "${name}"`);
          continue;
        }
      }
      if (this._plugins.has(name) && state.active) {
        await this.activate(name);
      }
    }
  }

  // ========== 事件钩子 ==========

  onHook(event, callback) {
    if (!this._hooks.has(event)) this._hooks.set(event, new Set());
    this._hooks.get(event).add(callback);
    window.eventBus?.on(event, callback);
  }

  offHook(event, callback) {
    if (this._hooks.has(event)) this._hooks.get(event).delete(callback);
    window.eventBus?.off(event, callback);
  }

  // ========== 扩展点注册（与之前相同） ==========

  _registerToolbar(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach(item => { if (!item.slot) item.slot = 'custom'; if (!this._toolbarSlots.has(item.slot)) this._toolbarSlots.set(item.slot, []); this._toolbarSlots.get(item.slot).push(item); });
    this._renderToolbarSlot('custom');
  }
  _unregisterToolbar(pluginName) { for (const [slot, items] of this._toolbarSlots) { const f = items.filter(i => i.plugin !== pluginName); if (f.length !== items.length) this._toolbarSlots.set(slot, f); } this._renderToolbarSlot('custom'); }

  _renderToolbarSlot(slot) {
    document.querySelectorAll('.tool-btn[data-plugin-slot]').forEach(el => el.remove());
    const items = this._toolbarSlots.get(slot);
    if (!items || items.length === 0) return;
    const toolbar = document.getElementById('toolbar');
    const spacer = toolbar.querySelector('.toolbar-spacer');
    const group = document.createElement('div');
    group.className = 'toolbar-group plugin-tools';
    group.dataset.pluginSlot = slot;
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.title = item.title || item.label || '';
      btn.dataset.pluginSlot = slot;
      if (item.icon) btn.innerHTML = item.icon;
      else { btn.textContent = item.label || '?'; btn.style.fontSize = '12px'; btn.style.fontWeight = '600'; }
      btn.addEventListener('click', () => { if (item.action) item.action(this._api); });
      group.appendChild(btn);
    });
    toolbar.insertBefore(group, spacer);
  }

  _registerMenu(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach(item => { if (!item.menu) item.menu = 'help'; if (!this._menuSlots.has(item.menu)) this._menuSlots.set(item.menu, []); this._menuSlots.get(item.menu).push(item); });
    this._renderMenuSlots();
  }
  _unregisterMenu(pluginName) { for (const [menu, items] of this._menuSlots) { this._menuSlots.set(menu, items.filter(i => i.plugin !== pluginName)); } this._renderMenuSlots(); }

  _renderMenuSlots() {
    document.querySelectorAll('.dropdown-menu .plugin-menu-item').forEach(el => el.remove());
    for (const [menuName, items] of this._menuSlots) {
      const dropdown = document.querySelector(`[data-menu="${menuName}"] .dropdown-menu`);
      if (!dropdown || items.length === 0) continue;
      const divider = document.createElement('div');
      divider.className = 'menu-divider plugin-menu-item';
      dropdown.appendChild(divider);
      items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'plugin-menu-item';
        btn.textContent = item.label || item.title || '';
        btn.addEventListener('click', () => { if (item.action) item.action(this._api); document.querySelectorAll('.menu-item.active').forEach(m => m.classList.remove('active')); });
        dropdown.appendChild(btn);
      });
    }
  }

  _registerEditorMode(mode) {
    this._editorModes.set(mode.id || mode.name, mode);
    const ms = document.querySelector('.mode-switcher');
    if (ms) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.title = mode.title || mode.displayName || mode.name;
      btn.dataset.mode = mode.id || mode.name;
      btn.dataset.pluginMode = 'true';
      if (mode.icon) btn.innerHTML = mode.icon;
      else { btn.textContent = (mode.displayName || mode.name).charAt(0).toUpperCase(); btn.style.fontSize = '12px'; btn.style.fontWeight = '600'; }
      btn.addEventListener('click', () => { window.eventBus?.emit(EVENTS.EDITOR_MODE_CHANGED, mode.id || mode.name); if (mode.activate) mode.activate(this._api); });
      ms.appendChild(btn);
    }
  }
  _unregisterEditorMode(pluginName) { for (const [id, mode] of this._editorModes) { if (mode.plugin === pluginName) { this._editorModes.delete(id); const btn = document.querySelector(`[data-mode="${id}"]`); if (btn) btn.remove(); } } }

  _registerSidebar(panel) { this._sidebarPanels.set(panel.id || panel.name, panel); this._renderSidebar(); }
  _unregisterSidebar(pluginName) { for (const [id, panel] of this._sidebarPanels) { if (panel.plugin === pluginName) this._sidebarPanels.delete(id); } this._renderSidebar(); }

  _renderSidebar() {
    let sidebar = document.getElementById('pluginSidebar');
    const panels = [...this._sidebarPanels.values()];
    if (panels.length === 0) { if (sidebar) sidebar.remove(); return; }
    if (!sidebar) { sidebar = document.createElement('aside'); sidebar.id = 'pluginSidebar'; sidebar.className = 'plugin-sidebar'; document.getElementById('editorArea')?.insertBefore(sidebar, document.getElementById('editorArea').firstChild); }
    sidebar.innerHTML = '';
    panels.forEach(panel => {
      const section = document.createElement('div');
      section.className = 'sidebar-section';
      section.id = 'sidebar-' + (panel.id || panel.name);
      const header = document.createElement('div');
      header.className = 'sidebar-header';
      header.textContent = panel.title || panel.displayName || panel.name;
      section.appendChild(header);
      const body = document.createElement('div');
      body.className = 'sidebar-body';
      if (panel.render) body.innerHTML = panel.render(this._api);
      else if (panel.html) body.innerHTML = panel.html;
      section.appendChild(body);
      sidebar.appendChild(section);
    });
  }

  _registerFileHandler(handler) { const exts = Array.isArray(handler.extensions) ? handler.extensions : [handler.extensions]; exts.forEach(ext => this._fileHandlers.set(ext.toLowerCase(), handler)); }
  _unregisterFileHandler(pluginName) { for (const [ext, handler] of this._fileHandlers) { if (handler.plugin === pluginName) this._fileHandlers.delete(ext); } }
  getFileHandler(ext) { return this._fileHandlers.get(ext.toLowerCase()); }

  _registerShortcut(sc) { window.keyboard?.register(sc.key, sc.action, { allowInInput: sc.allowInInput || false }); }

  // ========== 资源管理 ==========

  _getActiveContent() { const t = window.tabManager?.getActiveTab(); if (!t) return ''; if (t.mode === 'rich-text') return window.richTextEditor?.getContent() || ''; if (t.mode === 'code') return window.codeEditor?.getContent() || ''; if (t.mode === 'markdown') return window.markdownEditor?.getContent() || ''; return ''; }
  _setActiveContent(c) { const t = window.tabManager?.getActiveTab(); if (!t) return; if (t.mode === 'rich-text') window.richTextEditor?.setContent(c); else if (t.mode === 'code') window.codeEditor?.setContent(c); else if (t.mode === 'markdown') window.markdownEditor?.setContent(c); }
  _getActiveText() { const t = window.tabManager?.getActiveTab(); if (!t) return ''; if (t.mode === 'rich-text') return window.richTextEditor?.getText() || ''; if (t.mode === 'code') return window.codeEditor?.getContent() || ''; if (t.mode === 'markdown') return window.markdownEditor?.getContent() || ''; return ''; }

  _loadScript(src, track = false) {
    return new Promise((resolve, reject) => {
      if (this._loadedScripts.has(src)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { if (track) this._loadedScripts.add(src); resolve(); };
      s.onerror = () => reject(new Error('Script load failed: ' + src));
      document.head.appendChild(s);
    });
  }

  _loadStyle(href) {
    return new Promise((resolve) => {
      if (this._loadedStyles.has(href)) { resolve(); return; }
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = () => { this._loadedStyles.add(href); resolve(); };
      l.onerror = resolve;
      document.head.appendChild(l);
    });
  }

  _removeScript(src) {
    this._loadedScripts.delete(src);
    document.querySelectorAll(`script[src="${src}"]`).forEach(s => s.remove());
  }

  _removeStyle(href) {
    this._loadedStyles.delete(href);
    document.querySelectorAll(`link[href="${href}"]`).forEach(l => l.remove());
  }
}

window.pluginManager = new PluginManager();
