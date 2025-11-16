# CapCut SRT Formatter

这是一个使用 Vue.js 和 Vite 构建的简单Web应用，用于格式化和清理从剪映(CapCut)导出的SRT字幕文件。

剪映导出的SRT文件可能包含一些不必要的样式标签或格式问题，这个工具可以帮助你快速清理它们，得到一个干净的SRT文件。

## ✨ 功能

- **粘贴解析**：直接在文本框中粘贴从剪映复制的SRT字幕内容。
- **一键清理**：自动移除不必要的标签和多余的空行。
- **结果预览**：即时在页面上看到清理后的字幕效果。
- **简单高效**：纯前端处理，无需服务器，保护你的数据隐私。

## 🛠️ 技术栈

- **框架**: [Vue 3](https://vuejs.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **语言**: JavaScript

## 🚀 部署与运行

你需要 [Node.js](https://nodejs.org/) (建议版本 16.x 或更高) 和 npm/yarn/pnpm。

1.  **克隆项目到本地**
    ```bash
    git clone https://github.com/your-username/CapCutSRT-main.git
    ```

2.  **进入项目目录**
    ```bash
    cd CapCutSRT-main/vue
    ```

3.  **安装依赖**
    ```bash
    npm install
    ```

4.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    项目将在本地启动 (通常是 `http://localhost:5173`)。

5.  **构建生产版本**
    ```bash
    npm run build
    ```
    这会在 `vue` 目录下生成一个 `dist` 文件夹，其中包含了所有静态资源 (HTML, CSS, JS)。

6.  **部署 `dist` 目录**
    将 `dist` 文件夹中的所有内容上传到任何静态网站托管服务即可，例如：
    - GitHub Pages
    - Vercel
    - Netlify
    - 或你自己的Nginx/Apache服务器。
