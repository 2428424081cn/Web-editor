# Web 文本编辑器

一个基于纯原生 Vanilla JS 构建的全功能 Web 文本编辑器，无任何框架依赖。

## 功能特性

- **富文本编辑** — 加粗、斜体、下划线、列表、插入图片和链接
- **代码编辑** — 语法高亮、行号显示、自动缩进、括号匹配
- **Markdown 编辑** — 实时预览、GFM 支持、工具栏快捷操作
- **多标签页** — 拖拽排序、状态持久化
- **文件操作** — 新建、打开、保存、另存为、拖放导入、Word 导入/导出
- **查找替换** — 支持正则表达式、区分大小写
- **主题切换** — 亮色 / 暗色主题
- **插件系统** — 可扩展的插件架构，支持自定义插件开发
- **分屏编辑** — 水平 / 垂直分屏

## 技术栈

- 纯 JavaScript（ES6+），无框架依赖
- CSS 自定义属性（CSS Variables）实现主题
- `marked.js` — Markdown 渲染
- `mammoth.js` — Word 文件导入
- `docx.js` — Word 文件导出

## 使用方法

直接用浏览器打开 `index.html` 即可使用，无需构建或服务器。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+W` | 关闭标签 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` | 重做 |
| `Ctrl+F` | 查找 |
| `Ctrl+H` | 替换 |
| `Ctrl+B` | 加粗 |
| `Ctrl+I` | 斜体 |
| `Ctrl+U` | 下划线 |
| `Ctrl+Shift+T` | 切换主题 |
| `Ctrl+\\` | 水平分屏 |

## 插件开发

请参考 `插件开发文档.docx`，项目自带两个示例插件：

- `plugins/word-count.js` — 字数统计
- `plugins/timestamp.js` — 插入时间戳

## 项目结构

```
├── index.html          # 主入口
├── css/                # 样式文件
│   ├── variables.css   # CSS 变量
│   ├── base.css        # 基础样式
│   ├── layout.css      # 布局
│   ├── editor.css      # 编辑器
│   ├── themes.css      # 主题
│   ├── dialog.css      # 对话框
│   └── plugin.css      # 插件样式
├── js/
│   ├── core/           # 核心模块
│   ├── components/     # UI 组件
│   ├── services/       # 服务层
│   └── utils/          # 工具函数
├── lib/                # 第三方库
└── plugins/            # 插件
```
