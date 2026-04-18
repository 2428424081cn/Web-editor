/* ============================================
   FileService - 文件操作服务
   ============================================ */

class FileService {
  constructor() {
    this._handles = new Map(); // tabId -> FileSystemFileHandle
    this._supportsAccessAPI = 'showOpenFilePicker' in window;
  }

  /**
   * 检测是否支持 File System Access API
   */
  get supportsAccessAPI() {
    return this._supportsAccessAPI;
  }

  /**
   * 新建文件
   */
  async newFile(tabId) {
    this._handles.delete(tabId);
    await window.storage.deleteFileHandle(tabId);
    window.eventBus.emit(EVENTS.FILE_OPENED, { tabId, fileName: '未命名.txt', content: '', isNew: true });
  }

  /**
   * 打开文件
   */
  async openFile(tabId) {
    if (this._supportsAccessAPI) {
      return this._openWithAccessAPI(tabId);
    } else {
      return this._openWithFallback(tabId);
    }
  }

  /**
   * 使用 File System Access API 打开
   */
  async _openWithAccessAPI(tabId) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          { description: '文本文件', accept: { 'text/plain': ['.txt', '.md', '.js', '.ts', '.html', '.css', '.json', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.rb', '.php', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.sh', '.bat'] } },
          { description: 'Word 文档', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } },
          { description: '所有文件', accept: { '*/*': ['*'] } }
        ],
        multiple: false
      });

      const file = await handle.getFile();

      // 检查是否有插件处理器（如 Word 导入）
      const ext = DOM.getFileExtension(file.name);
      const pluginHandler = window.pluginManager.getFileHandler(ext);
      if (pluginHandler && pluginHandler.import) {
        await pluginHandler.import(file);
        return { fileName: file.name, content: '' };
      }

      const content = await file.text();

      this._handles.set(tabId, handle);
      await window.storage.saveFileHandle(tabId, handle);

      window.eventBus.emit(EVENTS.FILE_OPENED, {
        tabId,
        fileName: file.name,
        content,
        filePath: file.name,
        isNew: false
      });

      return { fileName: file.name, content };
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[FileService] Open error:', err);
        DOM.toast('打开文件失败', 'error');
      }
      return null;
    }
  }

  /**
   * 使用传统方式打开（降级方案）
   */
  async _openWithFallback(tabId) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md,.js,.ts,.html,.css,.json,.py,.java,.c,.cpp,.go,.rs,.rb,.php,.xml,.yaml,.yml,.sh,.bat,.docx,*';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) { resolve(null); return; }

        // 检查是否有插件处理器（如 Word 导入）
        const ext = DOM.getFileExtension(file.name);
        const pluginHandler = window.pluginManager.getFileHandler(ext);
        if (pluginHandler && pluginHandler.import) {
          await pluginHandler.import(file);
          resolve({ fileName: file.name, content: '' });
          return;
        }

        const content = await file.text();
        window.eventBus.emit(EVENTS.FILE_OPENED, {
          tabId,
          fileName: file.name,
          content,
          filePath: file.name,
          isNew: false
        });
        resolve({ fileName: file.name, content });
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  /**
   * 保存文件
   */
  async saveFile(tabId, content, fileName) {
    const handle = this._handles.get(tabId);

    if (handle && this._supportsAccessAPI) {
      return this._saveWithHandle(handle, content);
    } else {
      return this._saveAs(tabId, content, fileName);
    }
  }

  /**
   * 另存为
   */
  async saveAs(tabId, content, suggestedName) {
    if (this._supportsAccessAPI) {
      return this._saveAsAccessAPI(tabId, content, suggestedName);
    } else {
      return this._saveAsFallback(content, suggestedName);
    }
  }

  /**
   * 使用已有句柄保存
   */
  async _saveWithHandle(handle, content) {
    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      window.eventBus.emit(EVENTS.FILE_SAVED, { success: true });
      DOM.toast('文件已保存', 'success');
      return true;
    } catch (err) {
      console.error('[FileService] Save error:', err);
      DOM.toast('保存失败', 'error');
      return false;
    }
  }

  /**
   * 使用 Access API 另存为
   */
  async _saveAsAccessAPI(tabId, content, suggestedName) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedName || 'untitled.txt',
        types: [
          { description: '文本文件', accept: { 'text/plain': ['.txt'] } },
          { description: 'Markdown', accept: { 'text/markdown': ['.md'] } },
          { description: 'JavaScript', accept: { 'text/javascript': ['.js'] } },
          { description: 'HTML', accept: { 'text/html': ['.html'] } },
          { description: 'CSS', accept: { 'text/css': ['.css'] } },
          { description: 'JSON', accept: { 'application/json': ['.json'] } },
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      this._handles.set(tabId, handle);
      await window.storage.saveFileHandle(tabId, handle);

      const file = await handle.getFile();
      window.eventBus.emit(EVENTS.FILE_SAVED, { success: true, fileName: file.name });
      DOM.toast('文件已保存', 'success');
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[FileService] SaveAs error:', err);
        DOM.toast('保存失败', 'error');
      }
      return false;
    }
  }

  /**
   * 降级保存方案
   */
  _saveAsFallback(content, fileName) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'untitled.txt';
    a.click();
    URL.revokeObjectURL(url);
    window.eventBus.emit(EVENTS.FILE_SAVED, { success: true, fileName });
    DOM.toast('文件已下载', 'success');
    return true;
  }

  /**
   * 删除文件句柄
   */
  async removeHandle(tabId) {
    this._handles.delete(tabId);
    await window.storage.deleteFileHandle(tabId);
  }
}

// 全局单例
window.fileService = new FileService();
