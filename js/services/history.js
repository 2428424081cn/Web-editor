/* ============================================
   HistoryManager - 撤销/重做管理（命令模式）
   ============================================ */

class HistoryManager {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this._undoStack = [];
    this._redoStack = [];
    this._currentTabId = null;
  }

  /**
   * 设置当前标签页
   */
  setTab(tabId) {
    // 切换标签页时保存当前历史
    this._currentTabId = tabId;
    this._emitChange();
  }

  /**
   * 执行命令并记录
   */
  execute(command) {
    if (!command || !command.do || !command.undo) return;

    // 清空重做栈
    this._redoStack = [];

    // 限制栈大小
    if (this._undoStack.length >= this.maxSize) {
      this._undoStack.shift();
    }

    this._undoStack.push(command);
    this._emitChange();
  }

  /**
   * 记录快照（简单的状态记录）
   */
  pushSnapshot(content, cursorPos = null) {
    this._redoStack = [];

    if (this._undoStack.length >= this.maxSize) {
      this._undoStack.shift();
    }

    this._undoStack.push({
      content,
      cursorPos,
      timestamp: Date.now()
    });

    this._emitChange();
  }

  /**
   * 撤销
   * @returns {Object|null} 撤销的状态快照
   */
  undo() {
    if (!this.canUndo()) return null;
    const state = this._undoStack.pop();
    this._redoStack.push(state);
    this._emitChange();
    return state;
  }

  /**
   * 重做
   * @returns {Object|null} 重做的状态快照
   */
  redo() {
    if (!this.canRedo()) return null;
    const state = this._redoStack.pop();
    this._undoStack.push(state);
    this._emitChange();
    return state;
  }

  /**
   * 能否撤销
   */
  canUndo() {
    return this._undoStack.length > 0;
  }

  /**
   * 能否重做
   */
  canRedo() {
    return this._redoStack.length > 0;
  }

  /**
   * 清空历史
   */
  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._emitChange();
  }

  /**
   * 获取栈大小信息
   */
  getInfo() {
    return {
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length
    };
  }

  _emitChange() {
    window.eventBus.emit(EVENTS.HISTORY_CHANGED, this.getInfo());
  }
}

// 全局单例
window.historyManager = new HistoryManager();
