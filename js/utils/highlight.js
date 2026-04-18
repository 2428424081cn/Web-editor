/* ============================================
   HighlightService - CSS Custom Highlight API 封装
   ============================================ */

class HighlightService {
  constructor() {
    this._supported = typeof CSS !== 'undefined' && CSS.highlights !== undefined;
    this._currentLanguage = 'javascript';
  }

  /**
   * 检测是否支持 CSS Custom Highlight API
   */
  get supported() {
    return this._supported;
  }

  /**
   * 高亮代码
   * @param {HTMLElement} container - 包含文本节点的容器
   * @param {string} code - 源代码文本
   * @param {string} language - 编程语言
   */
  highlight(container, code, language = 'javascript') {
    this._currentLanguage = language;

    if (this._supported) {
      this._highlightWithAPI(container, code, language);
    } else {
      this._highlightWithSpans(container, code, language);
    }
  }

  /**
   * 使用 CSS Custom Highlight API 高亮
   */
  _highlightWithAPI(container, code, language) {
    // 清除旧的高亮
    CSS.highlights.clear();

    // 确保容器只有一个文本节点
    if (container.childNodes.length === 0) {
      container.textContent = code;
    } else if (container.childNodes.length > 1 || container.firstChild.nodeType !== Node.TEXT_NODE) {
      container.textContent = code;
    }

    const textNode = container.firstChild;
    if (!textNode) return;

    // 词法分析
    const tokens = window.lexer.tokenize(code, language);

    // 按类型分组
    const grouped = new Map();
    for (const token of tokens) {
      if (!grouped.has(token.type)) grouped.set(token.type, []);
      grouped.get(token.type).push(token);
    }

    // 为每种类型创建 Highlight 并注册
    for (const [type, typeTokens] of grouped) {
      const ranges = typeTokens.map(token => {
        const range = new Range();
        range.setStart(textNode, Math.min(token.start, textNode.length));
        range.setEnd(textNode, Math.min(token.end, textNode.length));
        return range;
      });

      try {
        const highlight = new Highlight(...ranges);
        CSS.highlights.set(`hl-${type}`, highlight);
      } catch (err) {
        // Range 创建失败时静默处理
      }
    }
  }

  /**
   * 使用 span 包裹高亮（降级方案）
   */
  _highlightWithSpans(container, code, language) {
    const tokens = window.lexer.tokenize(code, language);

    if (tokens.length === 0) {
      container.textContent = code;
      return;
    }

    // 构建 HTML
    let html = '';
    let lastEnd = 0;

    for (const token of tokens) {
      // 转义未匹配的文本
      if (token.start > lastEnd) {
        html += this._escapeHtml(code.substring(lastEnd, token.start));
      }
      // 转义匹配的文本并包裹
      html += `<span class="hl-${token.type}">${this._escapeHtml(token.text)}</span>`;
      lastEnd = token.end;
    }

    // 剩余文本
    if (lastEnd < code.length) {
      html += this._escapeHtml(code.substring(lastEnd));
    }

    container.innerHTML = html;
  }

  /**
   * 清除高亮
   */
  clear() {
    if (this._supported) {
      CSS.highlights.clear();
    }
  }

  /**
   * HTML 转义
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 全局单例
window.highlightService = new HighlightService();
