/**
 * 版本控制插件
 * 提供文档版本快照、历史记录、差异对比和版本回滚
 */
(function () {
  let _api = null;
  let _autoSnapshotTimer = null;
  let _lastContent = '';
  let _versionCounter = 0;

  // ==================== 差异算法 ====================

  function computeDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result = [];

    // LCS-based line diff
    const lcs = _buildLCS(oldLines, newLines);
    let oi = oldLines.length, ni = newLines.length;
    const stack = [];

    while (oi > 0 || ni > 0) {
      if (oi > 0 && ni > 0 && oldLines[oi - 1] === newLines[ni - 1]) {
        stack.push({ type: 'equal', text: oldLines[oi - 1], oldLine: oi, newLine: ni });
        oi--; ni--;
      } else if (ni > 0 && (oi === 0 || lcs[oi][ni - 1] >= lcs[oi - 1][ni])) {
        stack.push({ type: 'add', text: newLines[ni - 1], newLine: ni });
        ni--;
      } else {
        stack.push({ type: 'del', text: oldLines[oi - 1], oldLine: oi });
        oi--;
      }
    }

    return stack.reverse();
  }

  function _buildLCS(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp;
  }

  function renderDiffHtml(diff) {
    let html = '<div class="vc-diff">';
    for (const line of diff) {
      const escaped = _escapeHtml(line.text || '');
      if (line.type === 'add') {
        html += `<div class="vc-diff-add"><span class="vc-diff-marker">+</span>${escaped}</div>`;
      } else if (line.type === 'del') {
        html += `<div class="vc-diff-del"><span class="vc-diff-marker">-</span>${escaped}</div>`;
      } else {
        html += `<div class="vc-diff-eq"><span class="vc-diff-marker">&nbsp;</span>${escaped}</div>`;
      }
    }
    html += '</div>';
    return html;
  }

  function _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ==================== 版本管理 ====================

  async function saveSnapshot(label) {
    const tab = _api.tabs.getActive();
    if (!tab) return;

    const content = _api.editor.getContent();
    if (!content && content !== 0) return;

    // 避免保存与上一个版本相同的内容
    const versions = await window.storage.getVersionsByTab(tab.id);
    versions.sort((a, b) => b.timestamp - a.timestamp);
    if (versions.length > 0 && versions[0].content === content) return;

    _versionCounter++;
    const version = {
      id: tab.id + '-v' + _versionCounter,
      tabId: tab.id,
      content: content,
      timestamp: Date.now(),
      label: label || '',
      mode: tab.mode,
      title: tab.title
    };

    await window.storage.saveVersion(version);
    _lastContent = content;
    _api.ui.toast('版本快照已创建', 'success', 1500);
    _refreshSidebar();
  }

  async function restoreVersion(versionId) {
    const tab = _api.tabs.getActive();
    if (!tab) return;

    const versions = await window.storage.getVersionsByTab(tab.id);
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    _api.editor.setContent(version.content);
    _lastContent = version.content;
    _api.ui.toast('已回滚到版本: ' + _formatTime(version.timestamp), 'success');
  }

  async function deleteVersion(versionId) {
    const tab = _api.tabs.getActive();
    if (!tab) return;

    await window.storage.deleteVersion(versionId);
    _api.ui.toast('版本已删除', 'info', 1500);
    _refreshSidebar();
  }

  async function showDiff(versionId) {
    const tab = _api.tabs.getActive();
    if (!tab) return;

    const versions = await window.storage.getVersionsByTab(tab.id);
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    const currentContent = _api.editor.getText();
    const oldContent = _stripHtml(version.content);
    const diff = computeDiff(oldContent, currentContent);

    const diffEl = document.getElementById('vc-diff-view');
    const listEl = document.getElementById('vc-list-view');
    if (diffEl && listEl) {
      diffEl.innerHTML = `
        <div class="vc-diff-header">
          <button id="vc-diff-back" class="vc-btn-small">← 返回列表</button>
          <span class="vc-diff-title">当前 vs ${_formatTime(version.timestamp)}${version.label ? ' (' + _escapeHtml(version.label) + ')' : ''}</span>
        </div>
        ${renderDiffHtml(diff)}
      `;
      diffEl.style.display = '';
      listEl.style.display = 'none';

      document.getElementById('vc-diff-back').addEventListener('click', () => {
        diffEl.style.display = 'none';
        listEl.style.display = '';
      });
    }
  }

  function _stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }

  function _formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function _formatRelative(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return Math.floor(diff / 86400000) + ' 天前';
  }

  // ==================== 侧边栏渲染 ====================

  async function _refreshSidebar() {
    const el = document.getElementById('vc-stats');
    if (!el) return;

    const tab = _api.tabs.getActive();
    if (!tab) {
      el.innerHTML = '<div class="vc-empty">没有打开的文档</div>';
      return;
    }

    const versions = await window.storage.getVersionsByTab(tab.id);
    versions.sort((a, b) => b.timestamp - a.timestamp);

    if (versions.length === 0) {
      el.innerHTML = '<div class="vc-empty">暂无版本记录<br><small>按 Ctrl+Shift+S 保存时自动创建快照</small></div>';
      return;
    }

    let html = `<div class="vc-version-list" id="vc-list-view">`;
    html += `<div class="vc-list-header"><span>${versions.length} 个版本</span></div>`;

    for (const v of versions) {
      const label = v.label ? _escapeHtml(v.label) : _formatTime(v.timestamp);
      const relative = _formatRelative(v.timestamp);
      const modeIcon = v.mode === 'code' ? '⟨⟩' : v.mode === 'markdown' ? 'M↓' : 'T';

      html += `
        <div class="vc-version-item" data-version-id="${v.id}">
          <div class="vc-version-info">
            <div class="vc-version-label">${label}</div>
            <div class="vc-version-meta">
              <span class="vc-version-mode">${modeIcon}</span>
              <span class="vc-version-time" title="${_formatTime(v.timestamp)}">${relative}</span>
            </div>
          </div>
          <div class="vc-version-actions">
            <button class="vc-btn-icon" data-vc-diff="${v.id}" title="查看差异">Δ</button>
            <button class="vc-btn-icon" data-vc-restore="${v.id}" title="回滚到此版本">↩</button>
            <button class="vc-btn-icon vc-btn-danger" data-vc-delete="${v.id}" title="删除此版本">×</button>
          </div>
        </div>
      `;
    }

    html += '</div><div id="vc-diff-view" class="vc-diff-view" style="display:none"></div>';
    el.innerHTML = html;

    // 绑定事件
    el.querySelectorAll('[data-vc-diff]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDiff(btn.dataset.vcDiff);
      });
    });

    el.querySelectorAll('[data-vc-restore]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('确定要回滚到此版本吗？当前未保存的内容将会丢失。')) {
          restoreVersion(btn.dataset.vcRestore);
        }
      });
    });

    el.querySelectorAll('[data-vc-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteVersion(btn.dataset.vcDelete);
      });
    });
  }

  // ==================== 插件注册 ====================

  WebEditor.register({
    name: 'version-control',
    displayName: '版本控制',
    version: '1.0.0',
    description: '文档版本快照、历史记录、差异对比和版本回滚',

    activate(api) {
      _api = api;
      _lastContent = api.editor.getText();

      // 监听保存事件，自动创建快照
      this._unlistenSave = api.on('file:saved', () => {
        saveSnapshot();
      });

      // 监听标签切换，刷新侧边栏
      this._unlistenSwitch = api.on('tab:switched', () => {
        _lastContent = api.editor.getText();
        _refreshSidebar();
      });

      // 自动快照：内容变化 30 秒无新变化时自动保存版本（最多每 60 秒一次）
      this._unlistenChange = api.on('content:changed', () => {
        clearTimeout(_autoSnapshotTimer);
        _autoSnapshotTimer = setTimeout(() => {
          const current = api.editor.getText();
          if (current !== _lastContent && current.length > 10) {
            saveSnapshot('自动保存');
          }
        }, 30000);
      });

      _refreshSidebar();
    },

    deactivate() {
      if (this._unlistenSave) this._unlistenSave();
      if (this._unlistenSwitch) this._unlistenSwitch();
      if (this._unlistenChange) this._unlistenChange();
      clearTimeout(_autoSnapshotTimer);
    },

    sidebar: {
      id: 'version-control',
      title: '  版本历史',
      render() {
        return '<div id="vc-stats" style="font-size:13px;">加载中...</div>';
      }
    },

    toolbar: [
      {
        slot: 'custom',
        label: ' ',
        title: '创建版本快照',
        action(api) {
          saveSnapshot();
        }
      }
    ],

    shortcuts: [
      {
        key: 'mod+shift+v',
        label: '创建版本快照',
        action() {
          saveSnapshot();
        }
      }
    ],

    menu: [
      {
        menu: 'help',
        label: '版本控制 — 创建快照 (Ctrl+Shift+V)',
        action() {
          saveSnapshot();
        }
      }
    ]
  });
})();
