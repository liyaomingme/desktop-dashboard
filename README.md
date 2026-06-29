# Desktop Dashboard

> 📱 **Are you on a Smartphone? / 手机端用户请注意：**
> This repository is strictly optimized for Desktop and Tablet widescreen layouts (macOS, Windows, iPad). 
> 如果你在手机上使用，为了获得防键盘遮挡、单栏流体排版等极致体验，请前往手机端专属版本：
> 👉 **[Click here for Obsidian Mobile Dashboard / 点击获取手机专属版](https://github.com/liyaomingme/obsidian-mobile-dashboard)**

[🇬🇧 English Version](#-english-version) | [🇨🇳 中文说明](#-中文说明)

A desktop-first, beautifully crafted dashboard plugin for Obsidian. It transforms your blank startup screen into a highly productive control center featuring a dual-column layout, traditional typography, and a robust date-parsing engine.

---

## 🇬🇧 English Version

### ✨ Key Features

#### 1. Desktop-Class Dual-Column Layout
Designed specifically for widescreen displays (Desktops, Laptops, Tablets). It utilizes a smart CSS Grid architecture to beautifully separate the interactive calendar and the timeline footprints, ensuring maximum use of your screen real estate without feeling cluttered.

#### 2. Advanced Date Parser Engine (Sync-Proof)
Cross-device syncing (like iCloud or Syncthing) often resets file creation times, causing ordinary plugins to lose track of your notes. We solved this with a robust date parser:
* **Smart Extraction**: Automatically prioritizes the `date` property in YAML frontmatter.
* **Filename Fallback**: Intelligently extracts dates directly from filenames, supporting extreme shorthand formats (e.g., `0531`, `260602`, `26.06.02`, `26年6月2日`).
* **Folder Context**: If the year is omitted, the engine infers it from your folder path (e.g., `Journal/2026/05`).

#### 3. Traditional Typography & Almanac Aesthetics
* **Global Serif Integration**: High-quality local Serif/Songti fonts (like *Noto Serif SC*, *Songti SC*, *ui-serif*) across all elements for a premium reading experience.
* **Chinese Almanac (Bazi) Axis**: Displays the traditional Chinese calendar at the top. The "Year, Month, Day, Hour" indicators are elegantly shrunk and subscripted, mirroring traditional letterpress typography.

#### 4. Silky Smooth Quick Capture
A glassmorphism modal with flicker-free animations directly tied to Obsidian's native DOM lifecycle. Create notes rapidly with dynamic variables like `{{DATE}}` and `{{BAZI}}`.

### ⚙️ Installation

#### Method 1: Using BRAT (Recommended for Beta updates)
1. Install **[Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat)** from the Community Plugins in Obsidian and enable it.
2. Go to the BRAT settings, click on **Add Beta plugin**.
3. Paste this repository path: `liyaomingme/desktop-dashboard`
4. Click **Add Plugin**, wait for it to install, and then enable **Desktop Dashboard** in your installed plugins list.

#### Method 2: Manual Installation
1. Go to the **Releases** page of this repository.
2. Download the latest `main.js`, `manifest.json`, and `styles.css` files.
3. In your Obsidian vault, navigate to `.obsidian/plugins/` and create a new folder named `desktop-dashboard`.
4. Place the three downloaded files into this new folder.
5. Restart Obsidian, go to Settings > Community plugins, and enable the plugin.

---

## 🇨🇳 中文说明

欢迎使用 **Obsidian 桌面端控制中心 (Desktop Dashboard)**！这款插件致力于将你电脑和平板上单调的默认启动页，彻底改造为一个兼具**古典排版美学**与**桌面级生产力**的高级数据面板。

### ✨ 核心深度优化功能

#### 1. 桌面级双栏 Grid 架构
专为电脑、笔记本和 iPad 等宽屏设备量身打造。采用现代的 CSS Grid 布局，左侧为极具呼吸感的热力日历，右侧为优雅的波浪级联足迹列表。完美利用宽屏空间，大气且不失精美。

#### 2. 终极“日期嗅探”引擎 (彻底解决多设备同步丢失日期)
多设备同步（iCloud/坚果云等）经常会导致文件的“系统创建时间”被重置，从而让日历无法检索到你在手机上写的文章。我们重写了底层时间引擎：
* **智能正则嗅探**：不仅读取 YAML 区的 `date`，更能直接从**文件名**中强行提取日期。
* **极限速记支持**：完美支持各式各样的个人速记格式，无论是 `0531`、`260602` 、`26.06.02`，还是 `26年6月2日`，甚至是缩写 `2662`，引擎都能精准还原为标准日期。
* **目录穿透推断**：如果你的文件省去了年份，引擎会自动向上读取所在文件夹名称（如 `日记/2026/05`），智能补全上下文。

#### 3. 极致的传统宋体印刷美学
把传统活字印刷的质感带入现代软件：
* **全局宋体强制注入**：全面调用苹果系统的 `ui-serif` (Songti SC)、Windows 本地宋体与内置 `Noto Serif SC`。全方位覆盖高级衬线体，打破系统默认黑体的生硬感。
* **八字注排法美学**：顶部引入“天干地支”农历时间轴。运用传统排版的“大小字注排法”，将主干放大加粗，将“年、月、日、时”作为副单位精巧缩放至右下角，主副分明，极具品味。

#### 4. 丝滑快捷的灵感捕获弹窗
采用 `backdrop-filter` 磨砂玻璃背景，配合带有微弱内阴影的输入框，彻底消灭加载第一帧的“闪烁”现象。支持智能路径联想与自定义 `{{DATE}}`、`{{BAZI}}`（八字）模板变量。

### ⚙️ 安装教程

#### 方法一：通过 BRAT 安装（推荐，方便接收后续更新）
1. 在 Obsidian 的【第三方插件】市场中搜索并安装 **Obsidian42 - BRAT** 插件，并启用它。
2. 打开 BRAT 的设置页面，点击 **Add Beta plugin** 按钮。
3. 在弹出的输入框中填入本仓库的地址：`liyaomingme/desktop-dashboard`
4. 点击 **Add Plugin**，等待下载完成后，回到 Obsidian 的第三方插件列表，启用 **Desktop Dashboard** 即可。

#### 方法二：手动离线安装
1. 前往本仓库的 **Releases** 页面。
2. 下载最新版本中的三个核心文件：`main.js`、`manifest.json` 和 `styles.css`。
3. 打开你的 Obsidian 笔记库（Vault）所在的本地文件夹，进入 `.obsidian/plugins/` 目录。
4. 在该目录下新建一个名为 `desktop-dashboard` 的文件夹。
5. 将刚才下载的 3 个文件复制到这个新文件夹中。
6. 重启 Obsidian，进入【设置】 -> 【第三方插件】，找到并开启它。

### 🚀 如何使用
安装并启用后，进入插件设置页面：
1. **设为开屏主页**：开启“打开时启动”选项，即可在每次打开 Obsidian 桌面版时直接看到控制中心。
2. **自定义记录动作**：自由修改新建类型的名称、默认归档文件夹，以及带有 `{{DATE}}`、`{{TITLE}}`、`{{BAZI}}` 变量的 YAML 模板。

   <img width="864" height="1820" alt="岁时案台电脑" src="https://github.com/user-attachments/assets/c9f746b7-2cc8-440b-933a-5b41df125fb9" />

