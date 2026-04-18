/* ============================================
   DOMHelper - DOM 操作工具函数
   ============================================ */

const DOM = {
  /**
   * 查询单个元素
   */
  $(selector, parent = document) {
    return parent.querySelector(selector);
  },

  /**
   * 查询所有元素
   */
  $$(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
  },

  /**
   * 创建元素
   */
  create(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'html') {
        el.innerHTML = value;
      } else if (key === 'text') {
        el.textContent = value;
      } else {
        el.setAttribute(key, value);
      }
    }
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    }
    return el;
  },

  /**
   * 添加 class
   */
  addClass(el, ...classes) {
    el.classList.add(...classes);
  },

  /**
   * 移除 class
   */
  removeClass(el, ...classes) {
    el.classList.remove(...classes);
  },

  /**
   * 切换 class
   */
  toggleClass(el, className, force) {
    return el.classList.toggle(className, force);
  },

  /**
   * 判断是否包含 class
   */
  hasClass(el, className) {
    return el.classList.contains(className);
  },

  /**
   * 显示元素
   */
  show(el) {
    el.style.display = '';
  },

  /**
   * 隐藏元素
   */
  hide(el) {
    el.style.display = 'none';
  },

  /**
   * 防抖函数
   */
  debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 节流函数
   */
  throttle(fn, delay = 100) {
    let lastTime = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastTime >= delay) {
        lastTime = now;
        fn.apply(this, args);
      }
    };
  },

  /**
   * 显示 Toast 消息
   */
  toast(message, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * 获取文件扩展名
   */
  getFileExtension(filename) {
    const idx = filename.lastIndexOf('.');
    return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : '';
  },

  /**
   * 根据文件扩展名推断编辑器模式
   */
  getModeFromExtension(ext) {
    const map = {
      'js': 'code', 'ts': 'code', 'py': 'code', 'java': 'code', 'c': 'code',
      'cpp': 'code', 'h': 'code', 'cs': 'code', 'go': 'code', 'rs': 'code',
      'rb': 'code', 'php': 'code', 'swift': 'code', 'kt': 'code',
      'html': 'code', 'htm': 'code', 'xml': 'code', 'svg': 'code',
      'css': 'code', 'scss': 'code', 'less': 'code', 'json': 'code',
      'md': 'markdown', 'markdown': 'markdown', 'txt': 'rich-text',
      'docx': 'rich-text', 'rtf': 'rich-text',
    };
    return map[ext] || 'rich-text';
  },

  /**
   * 根据文件扩展名推断代码语言
   */
  getLangFromExtension(ext) {
    const map = {
      'js': 'javascript', 'mjs': 'javascript', 'jsx': 'javascript',
      'ts': 'javascript', 'tsx': 'javascript',
      'html': 'html', 'htm': 'html', 'xml': 'html', 'svg': 'html',
      'css': 'css', 'scss': 'css', 'less': 'css',
      'json': 'json',
      'py': 'python',
      'java': 'java', 'c': 'c', 'cpp': 'cpp', 'h': 'c',
      'go': 'go', 'rs': 'rust', 'rb': 'ruby', 'php': 'php',
    };
    return map[ext] || 'javascript';
  }
};

window.DOM = DOM;
