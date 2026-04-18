/* ============================================
   SearchService - 查找替换服务
   ============================================ */

class SearchService {
  constructor() {
    this._query = '';
    this._regex = null;
    this._matches = [];
    this._currentMatchIndex = -1;
    this._caseSensitive = false;
    this._useRegex = false;
  }

  /**
   * 搜索
   * @param {string} text - 要搜索的全文
   * @param {string} query - 搜索关键词
   * @param {Object} options - 选项
   * @returns {Object} 搜索结果
   */
  search(text, query, options = {}) {
    this._query = query;
    this._caseSensitive = options.caseSensitive || false;
    this._useRegex = options.useRegex || false;
    this._matches = [];
    this._currentMatchIndex = -1;

    if (!query) {
      this._emitResult();
      return { matches: [], total: 0, current: 0 };
    }

    try {
      let regex;
      if (this._useRegex) {
        regex = new RegExp(query, this._caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, this._caseSensitive ? 'g' : 'gi');
      }
      this._regex = regex;

      let match;
      while ((match = regex.exec(text)) !== null) {
        this._matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          line: this._getLineNumber(text, match.index)
        });

        // 防止无限循环（零长度匹配）
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } catch (err) {
      // 正则表达式无效
      this._matches = [];
    }

    if (this._matches.length > 0) {
      this._currentMatchIndex = 0;
    }

    this._emitResult();
    return this.getResult();
  }

  /**
   * 查找下一个
   */
  findNext() {
    if (this._matches.length === 0) return null;
    this._currentMatchIndex = (this._currentMatchIndex + 1) % this._matches.length;
    this._emitResult();
    return this._matches[this._currentMatchIndex];
  }

  /**
   * 查找上一个
   */
  findPrev() {
    if (this._matches.length === 0) return null;
    this._currentMatchIndex = (this._currentMatchIndex - 1 + this._matches.length) % this._matches.length;
    this._emitResult();
    return this._matches[this._currentMatchIndex];
  }

  /**
   * 替换当前匹配项
   * @param {string} text - 原文
   * @param {string} replacement - 替换文本
   * @returns {Object} { text, replaced }
   */
  replaceCurrent(text, replacement) {
    if (this._currentMatchIndex < 0 || this._matches.length === 0) {
      return { text, replaced: false };
    }

    const match = this._matches[this._currentMatchIndex];
    const newText = text.substring(0, match.start) + replacement + text.substring(match.end);

    return { text: newText, replaced: true };
  }

  /**
   * 替换所有匹配项
   * @param {string} text - 原文
   * @param {string} replacement - 替换文本
   * @returns {Object} { text, count }
   */
  replaceAll(text, replacement) {
    if (!this._regex || this._matches.length === 0) {
      return { text, count: 0 };
    }

    // 处理替换文本中的特殊引用
    let newRegex;
    if (this._useRegex) {
      newRegex = new RegExp(this._query, this._caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = this._query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      newRegex = new RegExp(escaped, this._caseSensitive ? 'g' : 'gi');
    }

    const count = this._matches.length;
    const newText = text.replace(newRegex, replacement);

    return { text: newText, count };
  }

  /**
   * 获取搜索结果摘要
   */
  getResult() {
    return {
      matches: this._matches,
      total: this._matches.length,
      current: this._currentMatchIndex >= 0 ? this._currentMatchIndex + 1 : 0,
      query: this._query
    };
  }

  /**
   * 获取当前匹配项
   */
  getCurrentMatch() {
    if (this._currentMatchIndex >= 0 && this._currentMatchIndex < this._matches.length) {
      return this._matches[this._currentMatchIndex];
    }
    return null;
  }

  /**
   * 获取匹配位置的行号
   */
  _getLineNumber(text, position) {
    return text.substring(0, position).split('\n').length;
  }

  _emitResult() {
    window.eventBus.emit(EVENTS.FIND_RESULT, this.getResult());
  }
}

// 全局单例
window.searchService = new SearchService();
