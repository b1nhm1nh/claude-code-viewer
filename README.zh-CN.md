# Claude Code Viewer

[English](./README.md) | **简体中文**

[![License](https://img.shields.io/github/license/d-kimuson/claude-code-viewer)](https://github.com/d-kimuson/claude-code-viewer/blob/main/LICENSE)
[![CI](https://github.com/d-kimuson/claude-code-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/d-kimuson/claude-code-viewer/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/d-kimuson/claude-code-viewer)](https://github.com/d-kimuson/claude-code-viewer/releases)

<img height="auto" width="50%" alt="ccv-logo" src="https://github.com/user-attachments/assets/0e092b2b-6acd-4380-b924-eed7a28acd69" />

功能完备的 Claude Code Web 客户端，支持管理 Claude Code 项目的全部交互操作。启动新对话、恢复已有会话、实时监控运行中的任务、浏览对话历史——全部通过现代化的 Web 界面完成。

https://github.com/user-attachments/assets/090d4806-163f-4bac-972a-002c7433145e

## 重要提示：Agent SDK 与订阅账户使用

> [!WARNING]
> 自 2026 年 4 月起，Anthropic 的[服务条款](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use)禁止使用 Agent SDK 以订阅账户**发送聊天消息**。虽然 Anthropic 在 X/Twitter 上的公告暗示个人使用可能是允许的，但允许与禁止之间的边界仍然模糊。
>
> 作为应对措施，**聊天发送、会话恢复、权限审批和 `AskUserQuestion`** 已改为按需启用。
>
> 请注意，实时对话日志查看、会话历史浏览、Git 操作以及所有其他只读功能均独立于 Agent SDK 实现，无论您使用何种认证模式均可完整使用。您可以从 CLI（或内置终端）启动 Claude Code 会话，然后在 Claude Code Viewer 中实时查看，不受任何限制。

### 选择认证模式

首次启动时（或在设置页面），系统会提示您选择认证方式：

- **API Key**（默认）— 直接使用 Anthropic API。所有功能（包括聊天发送）均可完整使用。
- **订阅账户** — 退出 Agent SDK 聊天功能。聊天输入框切换为复制模式：在表单中配置会话选项，然后点击 **Copy** 按钮获取等效的 `claude` CLI 命令（已包含对应参数）。在任何终端中粘贴并运行即可启动或恢复会话。会话运行后，Claude Code Viewer 会像往常一样实时显示对话内容。

### 内置终端

Claude Code Viewer 包含一个集成终端模拟器，可通过**屏幕底部的面板**访问。打开它，粘贴复制的命令，即可在浏览器中启动 Claude Code。

---

## 简介

Claude Code Viewer 是一个基于 Web 的 Claude Code 客户端，专注于**全面的会话日志分析**。通过严格的 Schema 校验和渐进式展开 UI，完整保留和组织所有对话数据。

**核心理念**：零数据丢失 + 高效组织 + 远程友好设计

## 系统要求

- **Node.js**：22.13.0 或更高版本
- **Claude Code**：v1.0.125 或更高版本
- **操作系统**：macOS、Linux 和 Windows（实验性支持 — 参见 [Windows 支持状态](#windows-支持状态)）

## Windows 支持状态

> [!NOTE]
> 上游项目（[d-kimuson/claude-code-viewer](https://github.com/d-kimuson/claude-code-viewer)）**不支持** Windows。本 `@ibootz` 分支是让 Claude Code Viewer 在 Windows 上原生运行的持续努力成果（PowerShell / `cmd.exe`，服务器本身无需 WSL 或 Git Bash）。

### 为支持 Windows 所做的修改

| 领域                                    | 原始行为                                                                                                                                   | Windows 兼容性修改                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Claude CLI 查找                         | 硬编码 `which -a claude`（仅限 POSIX）                                                                                                     | 在 `process.platform === "win32"` 时切换为 `where claude`；输出解析同时处理 `\n` 和 `\r\n`     |
| `node_modules/.bin` 优先级正则          | 直接构建 `new RegExp(\`${process.cwd()}/node_modules/.bin\`)`，Windows 反斜杠被正则编译器静默吞掉                                          | 转义正则特殊字符，匹配前将正则源和待测路径统一规范化为正斜杠                                   |
| 命令/技能名称解析                       | `pathToCommandName` 使用 `filePath.startsWith(baseDir)` 并仅将 `/` 替换为 `:`，混合 `\` / `/` 分隔符的目录布局会将绝对路径泄露到命令 ID 中 | 前缀比较和冒号替换前将两侧统一规范化为正斜杠                                                   |
| 数据库迁移                              | `migrations/` 文件夹路径解析                                                                                                               | 使用平台路径模块解析（提交 `359668b`）                                                         |
| `lint` 和 pre-push 钩子                 | 仅支持 POSIX `sh`                                                                                                                          | 使钩子脚本和 `build.sh` 可在 Windows 上通过 `bash` 调用（提交 `e700db0`、`5038392`）           |
| 发布脚本                                | 硬编码 `.sh` 调用                                                                                                                          | 检测 `process.platform === "win32"` 并适配（提交 `8c2a466`）                                   |
| `@replit/ruspty`（内置终端的 PTY 后端） | 作为硬依赖列出；每次 Windows 启动时加载失败并显示 `Cannot find module '@replit/ruspty-win32-x64-msvc'`                                     | 移至 `optionalDependencies`；在 `win32` 上终端服务短路为禁用路径，仅输出一条平静的 `INFO` 日志 |

### Windows 上仍**不可用**的功能

- **内置终端面板。** `@replit/ruspty` 未发布 `win32-x64-msvc`（或 `arm64`）二进制包。在我们（a）替换为跨平台 PTY 库如 [`node-pty`](https://github.com/microsoft/node-pty)，或（b）ruspty 自身发布 Windows 二进制包之前，屏幕底部的终端面板将显示"Terminal support is unavailable"。其他所有功能——聊天、会话、Git Diff、文件监视器、SSE 实时更新、MCP 查看器——均可正常使用。
- **端到端（E2E）测试脚本。** `scripts/e2e/*.sh` 仍假定 POSIX shell。单元测试套件（`pnpm test`）可在 Windows 上正常运行，但 Playwright 快照捕获尚未验证。
- **用户内容中的路径分隔符边界情况。** 已包含混合 `/` 和 `\` 的项目路径（例如手动输入到配置文件中的路径）可能仍会让某些下游消费者出现意外；如遇到此类问题，请提交 issue 并附上复现步骤。

### 终端的临时替代方案

如果您现在需要在 Windows 上使用终端面板，请在 **WSL2** 中运行 Claude Code Viewer — Linux 版的 `@replit/ruspty` 在其中可正常工作，您将获得完整体验。原生 Windows 用户可以打开独立的 `pwsh` / `cmd` 窗口来运行 **Copy** 按钮生成的 `claude` CLI 命令。

### 在本地验证 Windows 构建

```powershell
git clone https://github.com/ibootz/claude-code-viewer.git
cd claude-code-viewer
pnpm install
pnpm gatecheck check       # 应报告 4 passed, 0 failed
pnpm build
node .\dist\main.js --port 3400
```

服务器应以一条关于终端面板已禁用的 `INFO` 日志启动，除此之外在标准输出上不会产生任何警告。

## 安装与使用

### 快速启动（CLI）

无需安装，直接从 npm 运行：

```bash
npx @ibootz/claude-code-viewer@latest --port 3400
```

或者全局安装：

```bash
npm install -g @ibootz/claude-code-viewer
claude-code-viewer --port 3400
```

服务器将在端口 3400（或默认端口 3000）上启动。在浏览器中打开 `http://localhost:3400` 即可访问界面。

**可用选项：**

```bash
claude-code-viewer [选项]

Options:
  -p, --port <port>                监听端口（默认：3000）
  -h, --hostname <hostname>        监听主机名（默认：localhost）
  -v, --verbose                    启用详细调试日志
  -P, --password <password>        认证密码
  -e, --executable <executable>    Claude Code 可执行文件路径
  --claude-dir <claude-dir>        Claude 目录路径
  --api-only                       以纯 API 模式运行，不提供 Web UI
```

### 通过 Tailscale 远程访问（移动端 / PWA）

Claude Code Viewer 非常适合作为常驻服务器从手机访问。一种便捷的方式是在始终在线的机器上运行它，并通过 [Tailscale](https://tailscale.com/) 以 HTTPS 方式暴露：

1. 按照 [Tailscale HTTPS 证书指南](https://tailscale.com/docs/how-to/set-up-https-certificates) 在您的 Tailscale 节点上设置 HTTPS。
2. 绑定到所有接口并设置密码启动 Claude Code Viewer：

   ```bash
   claude-code-viewer --hostname 0.0.0.0 --port 3400 --password your-secret
   ```

3. 通过 Tailscale HTTPS URL（例如 `https://your-machine.ts.net:3400`）从手机访问。

Claude Code Viewer 是一个 **PWA（渐进式 Web 应用）**。在移动端，点击"添加到主屏幕"即可获得类似原生应用的体验，包含优化的 UI 和会话完成时的推送通知。

## 配置

### 命令行选项与环境变量

Claude Code Viewer 可通过命令行选项或环境变量进行配置。命令行选项优先于环境变量。

| 命令行选项                      | 环境变量                    | 说明                                                                                                                                                                                                           | 默认值       |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `-p, --port <port>`             | `PORT`                      | Claude Code Viewer 运行的端口号                                                                                                                                                                                | `3000`       |
| `-h, --hostname <hostname>`     | `HOSTNAME`                  | 远程访问时监听的主机名                                                                                                                                                                                         | `localhost`  |
| `-v, --verbose`                 | —                           | 启用详细调试日志。向 stderr 输出详细的服务端日志，用于故障排除                                                                                                                                                 | （未设置）   |
| `-P, --password <password>`     | `CCV_PASSWORD`              | 认证密码。设置后，启用基于密码的认证以保护对 Claude Code Viewer 的访问。所有 `/api` 路由（login、logout、check、config 和 version 端点除外）均需要认证。未设置时，认证被禁用，应用公开可访问                   | （无）       |
| `-e, --executable <executable>` | `CCV_CC_EXECUTABLE_PATH`    | Claude Code 安装路径。未设置时使用系统 PATH 中的安装，或回退到依赖中捆绑的版本                                                                                                                                 | （自动检测） |
| `--claude-dir <claude-dir>`     | `CCV_GLOBAL_CLAUDE_DIR`     | 存储会话日志的 Claude 目录路径                                                                                                                                                                                 | `~/.claude`  |
| `--terminal-disabled`           | `CCV_TERMINAL_DISABLED`     | 设置为 `1`/`true`（环境变量）或存在此标志（CLI）时禁用内置终端面板                                                                                                                                             | （未设置）   |
| `--terminal-shell <path>`       | `CCV_TERMINAL_SHELL`        | 终端会话的 Shell 可执行文件路径（如 `/bin/zsh`）                                                                                                                                                               | （自动检测） |
| `--terminal-unrestricted`       | `CCV_TERMINAL_UNRESTRICTED` | 设置为 `1`（环境变量）或存在此标志（CLI）时，禁用 bash 的受限 Shell 标志                                                                                                                                       | （未设置）   |
| `--api-only`                    | `CCV_API_ONLY`              | 以纯 API 模式运行。禁用 Web UI、终端 WebSocket 和非必要端点。仅暴露核心 API 路由（`/api/version`、`/api/config`、`/api/projects`、`/api/claude-code`、`/api/search`、`/api/sse`）。适用于与 n8n 等外部工具集成 | （未设置）   |

**破坏性变更**：环境变量名称已更改。如果您使用环境变量，请按以下方式更新：

- `CLAUDE_CODE_VIEWER_AUTH_PASSWORD` → `CCV_PASSWORD`
- `CLAUDE_CODE_VIEWER_CC_EXECUTABLE_PATH` → `CCV_CC_EXECUTABLE_PATH`
- 新增环境变量：`CCV_GLOBAL_CLAUDE_DIR`（此前 Claude 目录路径硬编码为 `~/.claude`）

### API 认证

设置 `--password` / `CCV_PASSWORD` 后，所有 `/api` 路由（认证相关端点除外）均需要认证。可通过两种方式认证：

1. **会话 Cookie**：使用 `/api/auth/login` 端点设置 `ccv-session` Cookie，然后在后续请求中携带。
2. **Authorization 头**：在每个请求中发送 `Authorization: Bearer <password>`。

如未配置密码，API 认证将被禁用。

### 用户设置

可在 Claude Code Viewer 侧边栏中配置各项设置。

| 设置                            | 默认值                       | 说明                                                                                                                                                                                 |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 隐藏无用户消息的会话            | true                         | Claude Code 会为 `/compact` 等操作创建日志，这些日志不与实际任务关联，可能产生噪音。启用后，不包含用户消息的会话将被隐藏。                                                           |
| 合并同名标题的会话              | false                        | 恢复会话时，Claude Code 会创建一个新会话并重新生成对话日志。启用后，仅显示同名标题的最新会话。                                                                                       |
| 遇到速率限制时自动调度 Continue | false                        | 当 Claude 遇到速率限制时自动调度 continue 消息。启用后，系统会检测实时会话中的速率限制错误，并在限制重置时间后一分钟创建调度任务发送"continue"。这避免了速率限制恢复时需要手动干预。 |
| 回车键行为                      | Shift+Enter                  | 指定哪种组合键发送消息。选项包括 Enter、Shift+Enter 和 Command+Enter。                                                                                                               |
| 搜索快捷键                      | Command+K                    | 选择打开搜索对话框的快捷键。选项包括 Ctrl+K 和 Command+K。                                                                                                                           |
| 查找快捷键                      | Command+F                    | 选择打开页面内查找栏的快捷键。选项包括 Ctrl+F 和 Command+F。                                                                                                                         |
| 模型选项                        | default, haiku, sonnet, opus | 自定义会话选项工具栏中显示的模型选项列表。可添加 Claude Code 支持的任何模型标识符（如 `claude-opus-4-5`）。                                                                          |
| 权限模式                        | 请求权限                     | 控制 Claude Code 请求工具调用时的审批逻辑。通过聊天输入上方的会话选项工具栏按项目配置。需要 Claude Code v1.0.82 或更高版本。                                                         |
| 主题                            | 跟随系统                     | 在深色模式和浅色模式之间切换。默认跟随系统设置。                                                                                                                                     |
| 通知                            | 无                           | 当运行中的会话进程完成时启用声音通知。可从多种通知声音中选择，并支持试听。                                                                                                           |
| 语言                            | 跟随系统                     | 界面语言选择。支持英语、日语和简体中文，自动检测系统设置。                                                                                                                           |

### 环境变量

**CCV_ENV 注意事项**：如果您在环境中设置了 `CCV_ENV=development`，应用将以开发模式启动。生产环境请设置 `CCV_ENV=production` 或保持未设置状态。

## 功能特性

| 功能             | 说明                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 查看聊天日志     | 通过 Web UI 实时查看 Claude Code 会话日志。支持历史日志，因为它使用标准 Claude Code 日志（~/.claude/projects/...）作为数据源                                                                                                         |
| 搜索对话         | 使用 `⌘K`（macOS）或 `Ctrl+K`（Linux）跨对话全文搜索。可在特定项目或所有项目中搜索。支持模糊匹配、前缀搜索和键盘导航（↑↓ 导航，Enter 选择）                                                                                          |
| 页内查找         | 使用可配置的快捷键（`Ctrl+F` / `Command+F`）跳转到当前对话中的任意文本。通过键盘导航循环遍历所有匹配项                                                                                                                               |
| 启动对话         | 直接从 Claude Code Viewer 启动 Claude Code 会话。享受文件/命令补全、暂停/恢复、工具审批等核心功能，体验更优的 Web 界面                                                                                                               |
| 恢复会话         | 直接从现有会话日志恢复对话                                                                                                                                                                                                           |
| 继续会话         | Claude Code Viewer 提供高级会话进程控制。通过 Claude Code Viewer 启动的会话保持活跃（除非被中止），允许您在不恢复的情况下继续对话（无需重新分配 session-id）                                                                         |
| 创建项目         | 从 Claude Code Viewer 创建新项目。通过 Web UI 选择目录执行 `/init` 命令并开始项目设置                                                                                                                                                |
| 会话选项工具栏   | 聊天输入上方的内联工具栏，用于配置每个项目的会话选项：模型选择、思考力度（low/medium/high/max）、权限模式和系统提示预设。设置按项目持久化                                                                                            |
| 语音输入         | 使用内置语音输入按钮在聊天输入框中直接口述消息。转录文本插入到输入字段中，可在发送前审阅                                                                                                                                             |
| 文件上传与预览   | 直接从聊天界面上传图片（PNG、JPEG、GIF、WebP）、PDF 和文本文件。每种文件类型使用专用预览组件显示——图片内联渲染，PDF 嵌入查看器，文本文件显示格式化内容                                                                               |
| 剪贴板图片粘贴   | 使用 `Ctrl+V` / `⌘V` 直接从剪贴板粘贴图片到聊天输入框。粘贴的图片在发送前会附加并预览                                                                                                                                                |
| 聊天草稿保存     | 聊天输入草稿按项目和会话自动保存。返回同一对话时，未发送的文本会被恢复                                                                                                                                                               |
| 浏览器预览       | 直接在 Claude Code Viewer 内预览 Web 应用。点击聊天消息中的任意 URL 的预览按钮，在右侧打开可调整大小的浏览器面板。功能包括带键盘导航的 URL 输入、重新加载功能和自动调整聊天窗口宽度。嵌入的浏览器跟踪您导航时的 URL 变化（仅限同源） |
| 消息调度器       | 使用 cron 表达式调度 Claude Code 消息用于周期性任务，或使用特定日期时间进行一次性执行。支持周期任务的并发控制（跳过/运行）和预定任务的自动删除                                                                                       |
| 审查变更         | 内置 Git Diff 查看器，允许您直接在 Claude Code Viewer 中审查所有变更。支持行内 diff 注释以标注特定行                                                                                                                                 |
| 提交变更         | 直接从 Web 界面在 Git Diff 查看器中执行 Git 提交                                                                                                                                                                                     |
| 推送变更         | 直接从 Git Diff 查看器推送已提交的变更。支持单独推送操作和组合的提交并推送工作流                                                                                                                                                     |
| 分支切换器       | 直接从 Git 标签页切换本地 Git 分支（带搜索和状态指示器）                                                                                                                                                                             |
| 文件浏览器       | 右侧面板标签页，汇总已编辑的文件并附带操作按钮，按项目分组，列出工具调用（带过滤器和快速文件预览），并在专用区域显示子代理会话                                                                                                       |
| 可视化工具显示   | 工具调用使用专用可视化组件渲染（如文件 Diff、结构化输出）。Raw 切换按钮可在需要时切换到纯 JSON 视图                                                                                                                                  |
| Todo 查看器      | 从会话中提取最新的 `TodoWrite` 条目，并作为可折叠清单直接在对话中内联显示                                                                                                                                                            |
| PR 链接显示      | `pr-link` 日志条目中的 Pull Request 元数据（标题、编号、URL）在对话中渲染为富文本卡片，便于导航到关联的 PR                                                                                                                           |
| 复制按钮         | 每条 Markdown 消息包含一个复制按钮，一键复制全文内容到剪贴板                                                                                                                                                                         |
| 项目切换器       | 通过标题栏的组合框快速跳转到任意项目，无需返回项目列表                                                                                                                                                                               |
| 行内审批         | 工具权限请求和来自 `CCVAskUserQuestion` MCP 工具的自定义问题直接在聊天中显示为行内面板，无需切换到其他窗口进行审批                                                                                                                   |
| 终端面板         | 通过 WebSocket 实现的底部面板终端，无需离开 UI 即可运行 Shell 命令                                                                                                                                                                   |
| MCP 服务器查看器 | 直接在会话侧边栏中查看 MCP 服务器配置。列出所有已配置的服务器及其名称和命令，支持实时重新加载                                                                                                                                        |
| PWA 支持         | 在桌面或移动设备上将 Claude Code Viewer 安装为渐进式 Web 应用。支持主屏幕安装和会话完成事件的推送通知                                                                                                                                |
| 系统信息         | 监控 Claude Code 和 Claude Code Viewer 版本、功能兼容性和系统状态                                                                                                                                                                    |
| 多语言支持       | 完整的国际化支持，提供英语、日语和简体中文语言选项                                                                                                                                                                                   |

## 截图

| 功能                   | 截图                                                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基本聊天（桌面端）     | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/desktop-dark.png)                               |
| 基本聊天（移动端）     | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/mobile-dark.png)                                |
| 浏览器预览（右侧面板） | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/right-panel-browser-opened/desktop-dark.png)    |
| Git 标签页（右侧面板） | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/right-panel-git-tab-opened/desktop-dark.png)    |
| 审查面板（右侧面板）   | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/right-panel-review-opened/desktop-dark.png)     |
| 文件 Diff（右侧面板）  | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/right-panel-file-diffs-opened/desktop-dark.png) |
| 设置                   | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/settings-tab/desktop-dark.png)                  |
| 启动新聊天             | ![](./e2e/snapshots/projects/L2hvbWUvcnVubmVyL3dvcmsvY2xhdWRlLWNvZGUtdmlld2VyL2NsYXVkZS1jb2RlLXZpZXdlci9tb2NrLWdsb2JhbC1jbGF1ZGUtZGlyL3Byb2plY3RzL3NhbXBsZS1wcm9qZWN0/session_sessionId_fe5e1c67-53e7-4862-81ae-d0e013e3270b/start-new-chat/desktop-dark.png)                |
| 项目列表               | ![](./e2e/snapshots/projects/desktop-dark.png)                                                                                                                                                                                                                               |
| 新建项目对话框         | ![](./e2e/snapshots/projects/new-project-modal/desktop-dark.png)                                                                                                                                                                                                             |
| 命令补全               | ![](./docs/assets/command_completion.png)                                                                                                                                                                                                                                    |
| 文件补全               | ![](./docs/assets/file_completion.png)                                                                                                                                                                                                                                       |
| Diff 查看器            | ![](./docs/assets/git_diff.png)                                                                                                                                                                                                                                              |

注意：更多 UI 截图可在 [/e2e/snapshots/](./e2e/snapshots/) 中查看。

## 数据源

应用从以下位置读取 Claude Code 对话日志：

- **位置**：`~/.claude/projects/<project>/<session-id>.jsonl`
- **格式**：包含对话条目的 JSONL 文件
- **自动检测**：自动发现新项目和会话

## 国际化（i18n）

Claude Code Viewer 目前支持**英语**、**日语**和**简体中文**。添加新语言非常简单——只需为您的新区域设置添加一个 `messages.json` 文件（参见 [src/i18n/locales/](./src/i18n/locales/) 中的示例）。

如果您希望支持您的语言，请提交 issue——我们会尽快添加！

## 替代方案与差异化

### 官方方案：Claude Code on the Web

Anthropic 提供了 [Claude Code on the Web](https://docs.claude.com/en/docs/claude-code/claude-code-on-the-web)，在 Anthropic 的云虚拟机中运行 Claude Code 会话。每个会话克隆您的仓库并执行预定义的设置命令（如 `pnpm install`）。

**何时使用 Claude Code on the Web**：

- 无需本地设置或自托管基础设施即可快速测试
- 从移动设备或公共计算机进行临时开发
- 简单的仓库结构，根目录下有单个 CLAUDE.md

**何时使用 Claude Code Viewer**：

- 使用预配置的本地环境（数据库、服务、大型依赖）
- 在不同目录中有多个 CLAUDE.md 文件的 monorepo 项目
- 需要大量计算资源或长时间运行进程的开发
- 希望自托管基础设施以完全控制开发环境

### 社区 Web 客户端

一些优秀的社区构建的 Web 客户端：

- https://github.com/sugyan/claude-code-webuisupport
- https://github.com/wbopan/cui
- https://github.com/siteboon/claudecodeui

**Claude Code Viewer 的独特之处**：虽然这些工具作为通用 Web 客户端表现出色，但 Claude Code Viewer 专门设计为**会话日志查看器**，具有以下特点：

- **零信息丢失**：严格的 Zod Schema 校验确保每个对话细节都被保留
- **渐进式展开**：可展开元素和子会话弹窗帮助管理信息密度
- **内置 Git 操作**：功能完备的 Diff 查看器，支持直接提交，适合远程开发工作流
- **会话流分析**：跨多个会话的完整对话跟踪
- **系统监控**：实时版本和功能兼容性监控
- **国际化可访问性**：面向全球开发团队的多语言支持

每个工具服务于不同的使用场景——选择最适合您工作流程和优先级的工具。

## 远程开发

Claude Code Viewer 在设计时考虑了远程托管。为支持远程开发工作流，它包含：

- **移动端优化的 UI**：响应式界面，配有专用移动侧边栏和触摸优化控件
- **内置 Git 操作**：直接从 Web 界面审查和提交变更
- **实时通知**：任务完成时的音频通知，帮助您保持工作流感知
- **系统监控**：监控跨环境的 Claude Code 兼容性和功能可用性

应用采用客户端-服务器分离架构，支持远程托管。通过 `--password` 命令行选项或 `CCV_PASSWORD` 环境变量提供**基本的密码认证**。设置后，用户必须使用配置的密码进行认证才能访问应用。然而，这是一个简单的单密码认证机制，没有多用户支持、基于角色的访问控制或 OAuth 集成等高级功能。如果您需要更复杂的认证，请仔细评估您的安全需求，并在基础设施层面实施适当的访问控制（例如带 OAuth 的反向代理、VPN、IP 白名单）。

## 隐私

有关隐私和网络通信的信息，请参阅 [PRIVACY.md](./PRIVACY.md)。

## 许可证

本项目采用 MIT 许可证。

## 贡献

详细的开发设置和贡献指南请参见 [docs/dev.md](docs/dev.md)。
