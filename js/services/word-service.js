/* ============================================
   WordService - Word 文档导入/导出服务
   ============================================
   
   导入：mammoth.js (.docx → HTML)
   导出：docx-js (HTML → .docx)
   
   作为内置插件注册到 PluginManager
   ============================================ */

class WordService {
  constructor() {
    this._mammothLoaded = false;
    this._docxJsLoaded = false;
  }

  /**
   * 初始化 - 注册为内置插件
   */
  async init() {
    // 注册 Word 文件处理器到插件系统
    window.pluginManager.register({
      name: 'word-compat',
      displayName: 'Word 文档兼容',
      version: '1.0.0',
      menu: [
        {
          menu: 'file',
          label: '导入 Word 文档 (.docx)',
          action: () => this.importDocx()
        },
        {
          menu: 'file',
          label: '导出为 Word 文档 (.docx)',
          action: () => this.exportDocx()
        }
      ],
      fileHandlers: [
        {
          extensions: ['docx'],
          label: 'Word 文档',
          import: (file) => this._importFile(file),
          export: (content, fileName) => this._exportFile(content, fileName)
        }
      ]
    });

    await window.pluginManager.activate('word-compat');
  }

  /**
   * 导入 .docx 文件
   */
  async importDocx() {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return;

    // 选择文件
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      await this._importFile(file, tab.id);
    };
    input.click();
  }

  /**
   * 导出为 .docx 文件
   */
  async exportDocx() {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return;

    const content = this._getActiveContent();
    const fileName = tab.title.replace(/\.[^.]+$/, '') + '.docx';
    await this._exportFile(content, fileName);
  }

  /**
   * 导入文件处理
   */
  async _importFile(file, tabId) {
    try {
      DOM.toast('正在解析 Word 文档...', 'info');

      await this._ensureMammoth();

      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
          ]
        }
      );

      const html = result.value;
      const targetTabId = tabId || window.tabManager.getActiveTab()?.id;

      if (targetTabId) {
        // 在新标签页打开
        const newTabId = window.tabManager.createTab({
          title: file.name,
          mode: 'rich-text',
          content: html
        });
        DOM.toast(`已导入: ${file.name}`, 'success');
      }

      if (result.messages.length > 0) {
        console.warn('[WordService] Conversion messages:', result.messages);
      }
    } catch (err) {
      console.error('[WordService] Import error:', err);
      DOM.toast('Word 文档导入失败: ' + err.message, 'error');
    }
  }

  /**
   * 导出文件处理
   */
  async _exportFile(content, fileName) {
    try {
      DOM.toast('正在生成 Word 文档...', 'info');
      await this._ensureDocxJs();

      const htmlContent = typeof content === 'string' && content.startsWith('<') ? content : `<p>${content}</p>`;
      const paragraphs = this._htmlToDocxParagraphs(htmlContent);

      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
              BorderStyle, WidthType, ShadingType } = docx;

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
                size: 24
              }
            }
          }
        },
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
          },
          children: paragraphs
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document.docx';
      a.click();
      URL.revokeObjectURL(url);

      DOM.toast(`已导出: ${fileName}`, 'success');
    } catch (err) {
      console.error('[WordService] Export error:', err);
      DOM.toast('Word 文档导出失败: ' + err.message, 'error');
    }
  }

  /**
   * 将 HTML 转换为 docx-js Paragraph 数组
   */
  _htmlToDocxParagraphs(html) {
    const { Paragraph, TextRun, HeadingLevel, AlignmentType,
            BorderStyle, WidthType, ShadingType, Table, TableRow, TableCell } = docx;

    const container = document.createElement('div');
    container.innerHTML = html;
    const paragraphs = [];

    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return new TextRun({ text: node.textContent || '' });
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return null;

      const tag = node.tagName.toLowerCase();
      const runs = [];
      for (const child of node.childNodes) {
        const run = processNode(child);
        if (run) runs.push(run);
      }

      switch (tag) {
        case 'h1':
          return new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: runs.length ? runs : [new TextRun({ text: node.textContent })]
          });
        case 'h2':
          return new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: runs.length ? runs : [new TextRun({ text: node.textContent })]
          });
        case 'h3':
          return new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: runs.length ? runs : [new TextRun({ text: node.textContent })]
          });
        case 'p':
          return new Paragraph({
            children: runs.length ? runs : [new TextRun({ text: node.textContent })]
          });
        case 'strong':
        case 'b':
          return new TextRun({ text: node.textContent, bold: true });
        case 'em':
        case 'i':
          return new TextRun({ text: node.textContent, italics: true });
        case 'u':
          return new TextRun({ text: node.textContent, underline: {} });
        case 'br':
          return new TextRun({ text: '', break: 1 });
        case 'ul':
        case 'ol':
          const items = [];
          for (const li of node.querySelectorAll(':scope > li')) {
            items.push(new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: li.textContent })]
            }));
          }
          return items;
        case 'li':
          return new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: node.textContent })]
          });
        case 'table':
          const rows = [];
          const trs = node.querySelectorAll('tr');
          trs.forEach((tr, idx) => {
            const cells = [];
            tr.querySelectorAll('td, th').forEach(td => {
              cells.push(new TableCell({
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: 'D5D8DC' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D5D8DC' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: 'D5D8DC' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: 'D5D8DC' },
                },
                children: [new Paragraph({ children: [new TextRun({ text: td.textContent })] })]
              }));
            });
            if (cells.length > 0) {
              rows.push(new TableRow({ children: cells }));
            }
          });
          if (rows.length > 0) return new Table({ rows });
          return null;
        case 'img':
          return new TextRun({ text: `[图片: ${node.alt || ''}]` });
        case 'a':
          return new TextRun({ text: node.textContent });
        case 'blockquote':
          return new Paragraph({
            indent: { left: 720 },
            children: [new TextRun({ text: node.textContent, italics: true, color: '5D6D7E' })]
          });
        case 'pre':
        case 'code':
          return new TextRun({
            text: node.textContent,
            font: { name: 'Consolas' }
          });
        default:
          if (runs.length > 0) return new Paragraph({ children: runs });
          return null;
      }
    };

    for (const child of container.childNodes) {
      const result = processNode(child);
      if (Array.isArray(result)) {
        paragraphs.push(...result);
      } else if (result) {
        paragraphs.push(result);
      }
    }

    return paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun({ text: '' })] })];
  }

  /**
   * 确保 mammoth.js 已加载
   */
  async _ensureMammoth() {
    if (window.mammoth) { this._mammothLoaded = true; return; }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'lib/mammoth.min.js';
      script.onload = () => { this._mammothLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('mammoth.js 加载失败'));
      document.head.appendChild(script);
    });
  }

  /**
   * 确保 docx-js 已加载
   */
  async _ensureDocxJs() {
    if (window.docx) { this._docxJsLoaded = true; return; }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'lib/docx.min.js';
      script.onload = () => { this._docxJsLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('docx-js 加载失败'));
      document.head.appendChild(script);
    });
  }

  _getActiveContent() {
    const tab = window.tabManager.getActiveTab();
    if (!tab) return '';
    if (tab.mode === 'rich-text') return window.richTextEditor.getContent();
    return window.richTextEditor.getContent();
  }
}

// 全局单例
window.wordService = new WordService();
