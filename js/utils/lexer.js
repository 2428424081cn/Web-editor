/* ============================================
   Lexer - 代码词法分析器
   ============================================ */

class Lexer {
  constructor() {
    // 语言规则定义
    this.rules = {
      javascript: [
        { type: 'comment', regex: /\/\/.*$/m },
        { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
        { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'string', regex: /`(?:[^`\\]|\\.)*`/ },
        { type: 'number', regex: /\b(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/ },
        { type: 'keyword', regex: /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|try|catch|finally|throw|typeof|instanceof|in|of|async|await|yield|void|delete|super|static|get|set|null|undefined|true|false|NaN|Infinity)\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$][\w$]*(?=\s*\()/ },
        { type: 'operator', regex: /(?:=>|\.\.\.|[+\-*/%=!<>&|^~?:]+)/ },
        { type: 'punctuation', regex: /[{}[\]();,.]/ },
      ],
      html: [
        { type: 'comment', regex: /<!--[\s\S]*?-->/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
        { type: 'tag', regex: /<\/?[a-zA-Z][\w-]*/ },
        { type: 'attribute', regex: /\b[a-zA-Z-]+(?=\s*=)/ },
        { type: 'punctuation', regex: /[<>=\/]/ },
      ],
      css: [
        { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
        { type: 'keyword', regex: /@(?:import|media|keyframes|font-face|charset|namespace|supports|layer)\b/ },
        { type: 'property', regex: /[\w-]+(?=\s*:)/ },
        { type: 'number', regex: /\b\d+\.?\d*(?:px|em|rem|%|vh|vw|deg|s|ms)?\b/ },
        { type: 'function', regex: /\b[a-zA-Z-]+(?=\s*\()/ },
        { type: 'punctuation', regex: /[{}():;,>.]/ },
      ],
      python: [
        { type: 'comment', regex: /#.*$/m },
        { type: 'string', regex: /"""[\s\S]*?"""/ },
        { type: 'string', regex: /'''[\s\S]*?'''/ },
        { type: 'string', regex: /f"(?:[^"\\]|\\.)*"/ },
        { type: 'string', regex: /f'(?:[^'\\]|\\.)*'/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
        { type: 'number', regex: /\b(?:0x[\da-fA-F]+|0b[01]+|0o[0-7]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/ },
        { type: 'keyword', regex: /\b(?:def|class|return|if|elif|else|for|while|break|continue|import|from|as|try|except|finally|raise|with|yield|lambda|pass|del|global|nonlocal|assert|in|not|and|or|is|True|False|None|self|async|await)\b/ },
        { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: 'operator', regex: /[+\-*/%=!<>&|^~@:]+/ },
        { type: 'punctuation', regex: /[{}[\]();,.]/ },
      ],
      json: [
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'number', regex: /-?\b\d+\.?\d*(?:e[+-]?\d+)?\b/ },
        { type: 'keyword', regex: /\b(?:true|false|null)\b/ },
        { type: 'punctuation', regex: /[{}[\]:,]/ },
      ],
    };
  }

  /**
   * 对代码进行词法分析
   * @param {string} code - 源代码
   * @param {string} language - 语言
   * @returns {Array} token 数组 [{ type, start, end, text }]
   */
  tokenize(code, language = 'javascript') {
    const rules = this.rules[language] || this.rules.javascript;
    const tokens = [];
    const tokenMap = new Array(code.length).fill(null);

    for (const rule of rules) {
      const regex = new RegExp(rule.regex.source, rule.regex.flags);
      let match;
      while ((match = regex.exec(code)) !== null) {
        // 检查是否已被更高优先级的规则占用
        let occupied = false;
        for (let i = match.index; i < match.index + match[0].length; i++) {
          if (tokenMap[i] !== null) { occupied = true; break; }
        }
        if (occupied) {
          if (match[0].length === 0) regex.lastIndex++;
          continue;
        }

        // 标记占用
        for (let i = match.index; i < match.index + match[0].length; i++) {
          tokenMap[i] = rule.type;
        }

        tokens.push({
          type: rule.type,
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });

        if (match[0].length === 0) regex.lastIndex++;
      }
    }

    // 按位置排序
    tokens.sort((a, b) => a.start - b.start);
    return tokens;
  }
}

// 全局单例
window.lexer = new Lexer();
