/* ============================================
   StorageManager - IndexedDB 存储管理
   ============================================ */

class StorageManager {
  constructor() {
    this.dbName = 'WebEditorDB';
    this.dbVersion = 1;
    this.db = null;
  }

  /**
   * 初始化数据库
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 标签页存储
        if (!db.objectStoreNames.contains('tabs')) {
          const tabStore = db.createObjectStore('tabs', { keyPath: 'id' });
          tabStore.createIndex('order', 'order');
        }

        // 编辑器设置
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 文件句柄存储（File System Access API）
        if (!db.objectStoreNames.contains('fileHandles')) {
          db.createObjectStore('fileHandles', { keyPath: 'tabId' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[Storage] Failed to open database:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * 通用事务执行
   */
  _transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = callback(store);

      if (result && result.onsuccess !== undefined) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      }
    });
  }

  // ---- 标签页操作 ----

  async saveTab(tabData) {
    return this._transaction('tabs', 'readwrite', store => store.put(tabData));
  }

  async getTab(tabId) {
    return this._transaction('tabs', 'readonly', store => store.get(tabId));
  }

  async getAllTabs() {
    return this._transaction('tabs', 'readonly', store => store.getAll());
  }

  async deleteTab(tabId) {
    return this._transaction('tabs', 'readwrite', store => store.delete(tabId));
  }

  async clearTabs() {
    return this._transaction('tabs', 'readwrite', store => store.clear());
  }

  // ---- 设置操作 ----

  async saveSetting(key, value) {
    return this._transaction('settings', 'readwrite', store => store.put({ key, value }));
  }

  async getSetting(key) {
    const result = await this._transaction('settings', 'readonly', store => store.get(key));
    return result ? result.value : null;
  }

  // ---- 文件句柄操作 ----

  async saveFileHandle(tabId, handle) {
    return this._transaction('fileHandles', 'readwrite', store => store.put({ tabId, handle }));
  }

  async getFileHandle(tabId) {
    const result = await this._transaction('fileHandles', 'readonly', store => store.get(tabId));
    return result ? result.handle : null;
  }

  async deleteFileHandle(tabId) {
    return this._transaction('fileHandles', 'readwrite', store => store.delete(tabId));
  }
}

// 全局单例
window.storage = new StorageManager();
