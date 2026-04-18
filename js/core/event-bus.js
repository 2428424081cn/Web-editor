/* ============================================
   EventBus - 全局事件总线（发布/订阅模式）
   ============================================ */

class EventBus {
  constructor() {
    this._listeners = new Map();
    this._onceListeners = new Map();
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  /**
   * 订阅事件（仅触发一次）
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  }

  /**
   * 取消订阅
   */
  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  }

  /**
   * 发布事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    if (this._listeners.has(event)) {
      for (const callback of this._listeners.get(event)) {
        try {
          callback(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  /**
   * 清除所有订阅
   */
  clear() {
    this._listeners.clear();
    this._onceListeners.clear();
  }
}

// 全局单例
window.eventBus = new EventBus();

// 事件常量
window.EVENTS = {
  // 标签页事件
  TAB_CREATED: 'tab:created',
  TAB_CLOSED: 'tab:closed',
  TAB_SWITCHED: 'tab:switched',
  TAB_UPDATED: 'tab:updated',

  // 内容事件
  CONTENT_CHANGED: 'content:changed',
  CURSOR_CHANGED: 'cursor:changed',
  SELECTION_CHANGED: 'selection:changed',

  // 文件事件
  FILE_OPENED: 'file:opened',
  FILE_SAVED: 'file:saved',
  FILE_MODIFIED: 'file:modified',

  // 编辑器事件
  EDITOR_MODE_CHANGED: 'editor:mode-changed',
  FORMAT_APPLIED: 'editor:format-applied',

  // 历史事件
  UNDO: 'history:undo',
  REDO: 'history:redo',
  HISTORY_CHANGED: 'history:changed',

  // 查找替换
  FIND_OPEN: 'find:open',
  FIND_CLOSE: 'find:close',
  FIND_NEXT: 'find:next',
  FIND_PREV: 'find:prev',
  FIND_RESULT: 'find:result',
  REPLACE: 'replace:one',
  REPLACE_ALL: 'replace:all',

  // 主题
  THEME_CHANGED: 'theme:changed',

  // 操作
  ACTION: 'action',
};
