/**
 * 示例插件：时间戳插入
 * 演示工具栏按钮和快捷键注册
 */
(function () {
  WebEditor.register({
    name: 'timestamp',
    displayName: '时间戳插入',
    version: '1.0.0',

    toolbar: [
      {
        slot: 'custom',
        label: '🕐',
        title: '插入当前时间',
        action(api) {
          const now = new Date();
          const formatted = now.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
          api.editor.insertText(formatted);
        }
      }
    ],

    shortcuts: [
      {
        key: 'mod+shift+d',
        label: '插入时间戳',
        action() {
          const api = window.WebEditor;
          const now = new Date();
          api.editor.insertText(now.toLocaleString('zh-CN'));
        }
      }
    ],

    menu: [
      {
        menu: 'edit',
        label: '插入时间戳 (Ctrl+Shift+D)',
        action(api) {
          const now = new Date();
          api.editor.insertText(now.toLocaleString('zh-CN'));
        }
      }
    ]
  });
})();
