/**
 * 示例插件：字数统计
 * 演示如何使用 WebEditor API 注册插件
 */
(function () {
  WebEditor.register({
    name: 'word-count',
    displayName: '字数统计',
    version: '1.0.0',

    activate(api) {
      this._update(api);
      this._unlisten = api.on('content:changed', () => this._update(api));
    },

    deactivate() {
      if (this._unlisten) this._unlisten();
    },

    sidebar: {
      id: 'word-count',
      title: '📊 字数统计',
      render(api) {
        return '<div id="wc-stats" style="font-size:13px;line-height:2;">加载中...</div>';
      }
    },

    toolbar: [
      {
        slot: 'custom',
        label: '字数',
        title: '字数统计',
        action(api) {
          const text = api.editor.getText();
          const chars = text.length;
          const words = text.trim() ? text.trim().split(/\s+/).length : 0;
          const lines = text.split('\n').length;
          api.ui.toast(`字符: ${chars} | 词: ${words} | 行: ${lines}`, 'info');
        }
      }
    ],

    _update(api) {
      const el = document.getElementById('wc-stats');
      if (!el) return;
      const text = api.editor.getText();
      const chars = text.length;
      const charsNoSpace = text.replace(/\s/g, '').length;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      // 中文字数统计
      const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
      const lines = text.split('\n').length;
      const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
          <span>字符数</span><span style="text-align:right;font-weight:600">${chars.toLocaleString()}</span>
          <span>字符(无空格)</span><span style="text-align:right;font-weight:600">${charsNoSpace.toLocaleString()}</span>
          <span>中文字符</span><span style="text-align:right;font-weight:600">${cjk.toLocaleString()}</span>
          <span>英文单词</span><span style="text-align:right;font-weight:600">${words.toLocaleString()}</span>
          <span>行数</span><span style="text-align:right;font-weight:600">${lines.toLocaleString()}</span>
          <span>段落数</span><span style="text-align:right;font-weight:600">${paragraphs.toLocaleString()}</span>
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-secondary);font-size:11px;color:var(--text-tertiary);">
          预计阅读时间: ${Math.max(1, Math.ceil(cjk / 400 + words / 200))} 分钟
        </div>
      `;
    }
  });
})();
