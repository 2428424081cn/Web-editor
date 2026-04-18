/* ============================================
   KeyboardShortcut - 快捷键管理
   ============================================ */

class KeyboardShortcut {
  constructor() {
    this._shortcuts = new Map();
    this._enabled = true;
    this._handler = this._handleKeyDown.bind(this);
  }

  /**
   * 初始化（绑定全局键盘事件）
   */
  init() {
    document.addEventListener('keydown', this._handler);
  }

  /**
   * 注册快捷键
   * @param {string} key - 快捷键描述，如 'ctrl+s', 'ctrl+shift+t', 'f3'
   * @param {Function} callback - 回调函数
   * @param {Object} options - 选项
   */
  register(key, callback, options = {}) {
    const normalized = this._normalize(key);
    if (!this._shortcuts.has(normalized)) {
      this._shortcuts.set(normalized, []);
    }
    this._shortcuts.get(normalized).push({ callback, options });
  }

  /**
   * 注销快捷键
   */
  unregister(key) {
    const normalized = this._normalize(key);
    this._shortcuts.delete(normalized);
  }

  /**
   * 启用/禁用快捷键
   */
  setEnabled(enabled) {
    this._enabled = enabled;
  }

  /**
   * 规范化快捷键字符串
   */
  _normalize(key) {
    return key.toLowerCase()
      .replace(/\s+/g, '')
      .replace('ctrl', 'mod')
      .replace('cmd', 'mod')
      .replace('command', 'mod');
  }

  /**
   * 处理键盘按下事件
   */
  _handleKeyDown(e) {
    if (!this._enabled) return;

    // 忽略输入框中的快捷键（除了特定的全局快捷键）
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

    // 构建当前按键组合
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('mod');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    let keyName = e.key.toLowerCase();
    // 特殊键名映射
    if (keyName === ' ') keyName = 'space';
    if (keyName === 'escape') keyName = 'esc';
    if (e.key.length === 1) keyName = keyName.toLowerCase();

    parts.push(keyName);
    const combo = parts.join('+');

    // 查找匹配的快捷键
    const shortcuts = this._shortcuts.get(combo);
    if (shortcuts) {
      for (const { callback, options } of shortcuts) {
        // 如果在输入框中且不允许在输入框触发，跳过
        if (isInput && !options.allowInInput) continue;
        // 如果有条件判断
        if (options.condition && !options.condition()) continue;

        e.preventDefault();
        e.stopPropagation();
        callback(e);
        return;
      }
    }
  }

  /**
   * 销毁
   */
  destroy() {
    document.removeEventListener('keydown', this._handler);
    this._shortcuts.clear();
  }
}

// 全局单例
window.keyboard = new KeyboardShortcut();
