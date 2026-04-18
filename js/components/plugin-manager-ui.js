/* ============================================
   PluginManagerUI - 插件管理器可视化界面
   ============================================ */

class PluginManagerUI {
  constructor() {
    this._modal = null;
    this._init();
  }

  _init() {
    // 监听插件变化，实时刷新列表
    window.pluginManager.onUIChange((plugins) => this._renderList(plugins));

    // 监听菜单打开
    window.eventBus?.on('action', (action) => {
      if (action === 'plugin-manager') this.open();
    });
  }

  open() {
    if (!this._modal) this._createModal();
    this._modal.style.display = '';
    this._renderList(window.pluginManager.getAllPlugins());
  }

  close() {
    if (this._modal) this._modal.style.display = 'none';
  }

  _createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'pluginManagerModal';

    overlay.innerHTML = `
      <div class="modal" style="min-width:560px;max-width:640px;">
        <div class="modal-header">
          <h3>🔌 插件管理</h3>
          <button class="modal-close" id="pmClose">&times;</button>
        </div>
        <div class="modal-body" style="padding:0;">
          <!-- 安装区域 -->
          <div style="padding:12px 16px;border-bottom:1px solid var(--border-secondary);display:flex;gap:8px;">
            <input type="text" id="pmUrlInput" class="modal-input" placeholder="输入插件脚本 URL..." style="flex:1;height:32px;font-size:13px;">
            <button class="btn btn-primary" id="pmInstallBtn" style="height:32px;padding:0 16px;font-size:13px;white-space:nowrap;">安装</button>
          </div>
          <!-- 插件列表 -->
          <div id="pmPluginList" style="max-height:400px;overflow-y:auto;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._modal = overlay;

    // 关闭
    document.getElementById('pmClose').addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });

    // 安装
    document.getElementById('pmInstallBtn').addEventListener('click', () => {
      const url = document.getElementById('pmUrlInput').value.trim();
      if (url) {
        window.pluginManager.installFromUrl(url);
        document.getElementById('pmUrlInput').value = '';
      }
    });
    document.getElementById('pmUrlInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('pmInstallBtn').click();
    });
  }

  _renderList(plugins) {
    const list = document.getElementById('pmPluginList');
    if (!list) return;

    if (plugins.length === 0) {
      list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-tertiary);font-size:13px;">暂无已安装的插件</div>';
      return;
    }

    list.innerHTML = plugins.map(p => {
      const isBuiltin = p.source === 'builtin';
      const sourceLabel = isBuiltin ? '内置' : (p.source === 'url' ? '远程' : '本地');
      return `
        <div class="pm-item" data-name="${p.name}">
          <div class="pm-item-info">
            <div class="pm-item-name">
              ${this._esc(p.displayName || p.name)}
              <span class="pm-item-version">v${p.version || '0.0.0'}</span>
              <span class="pm-item-source ${isBuiltin ? 'builtin' : ''}">${sourceLabel}</span>
            </div>
            ${p.description ? `<div class="pm-item-desc">${this._esc(p.description)}</div>` : ''}
            ${p.author ? `<div class="pm-item-author">by ${this._esc(p.author)}</div>` : ''}
          </div>
          <div class="pm-item-actions">
            <button class="pm-toggle ${p.active ? 'on' : ''}" data-action="toggle" title="${p.active ? '停用' : '启用'}"></button>
            ${!isBuiltin ? `<button class="pm-uninstall" data-action="uninstall" title="卸载">✕</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 绑定事件
    list.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.closest('.pm-item').dataset.name;
        const plugin = window.pluginManager.getPlugin(name);
        if (plugin?.active) {
          window.pluginManager.deactivate(name);
        } else {
          window.pluginManager.activate(name);
        }
      });
    });

    list.querySelectorAll('[data-action="uninstall"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.closest('.pm-item').dataset.name;
        window.pluginManager.uninstall(name);
      });
    });
  }

  _esc(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
}

window.pluginManagerUI = new PluginManagerUI();
