import { Plugin, WorkspaceLeaf, ItemView, TFolder, Modal, Setting, PluginSettingTab, App, TFile } from 'obsidian';
import moment from 'moment';
import { Lunar } from 'lunar-javascript';

const VIEW_TYPE_DASHBOARD = "desktop-dashboard-view";

interface ActionConfig { name: string; folder: string; template: string; }
interface DashboardSettings { openOnStartup: boolean; actions: ActionConfig[]; }

const DEFAULT_SETTINGS: DashboardSettings = {
    openOnStartup: false,
    actions: [
        { name: '新建日记', folder: '日记/{{YYYY}}/{{MM}}', template: "---\ntype: diary\ndate: {{DATE}}\nbazi: {{BAZI}}\n---\n\n" },
        { name: '沉淀知识', folder: '知识库/{{YYYY}}', template: "---\ntype: knowledge\ndate: {{DATE}}\nbazi: {{BAZI}}\n---\n\n" },
        { name: '灵感碎片', folder: '灵感捕捉', template: "---\ntype: idea\ndate: {{DATE}}\nbazi: {{BAZI}}\n---\n\n" }
    ]
}

export default class DashboardPlugin extends Plugin {
    settings: DashboardSettings;
    async onload() {
        await this.loadSettings();
        this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
        this.addRibbonIcon('layout-dashboard', '控制中心', () => { this.activateView().catch(console.error); });
        this.addCommand({ id: 'show-dashboard', name: '显示控制中心', callback: () => { this.activateView().catch(console.error); } });
        this.addSettingTab(new DashboardSettingTab(this.app, this));
        this.app.workspace.onLayoutReady(() => { if (this.settings.openOnStartup) this.activateView().catch(console.error); });
    }
    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() { await this.saveData(this.settings); }
    async activateView() {
        let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];
        if (!leaf) { 
            leaf = this.app.workspace.getLeaf('tab'); 
            await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true }); 
        }
        this.app.workspace.revealLeaf(leaf);
    }
}

class DashboardView extends ItemView {
    plugin: DashboardPlugin;
    boardArea: HTMLElement;
    currentMonth: moment.Moment;
    fileDataMap: Record<string, TFile[]> = {}; 
    listWrapper: HTMLElement;
    listScrollArea: HTMLElement;
    listHeader: HTMLElement;
    plusMenu: HTMLElement;
    private globalClickListener: (() => void) | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: DashboardPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentMonth = moment().startOf('month');
    }

    getViewType() { return VIEW_TYPE_DASHBOARD; }
    getDisplayText() { return "控制中心"; }
    getIcon() { return "layout-dashboard"; }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('dashboard-container');
        
        // 官方推荐安全的多端本地语言提取
        moment.locale('zh-cn');

        this.buildFileDataMap();

        const headerRow = container.createDiv({ cls: 'dashboard-header-row' });
        const header = headerRow.createDiv({ cls: 'baseline-header' });
        header.createDiv({ text: moment().format('M月D日 dddd'), cls: 'baseline-date' });

        const now = new Date();
        const lunarNow = Lunar.fromDate(now);
        
        const baziEl = header.createEl('h1', { cls: 'baseline-title bazi-title' });
        baziEl.innerHTML = `${lunarNow.getYearInGanZhi()}<span class="bazi-unit">年</span><span class="bazi-sep">·</span>${lunarNow.getMonthInGanZhi()}<span class="bazi-unit">月</span><span class="bazi-sep">·</span>${lunarNow.getDayInGanZhi()}<span class="bazi-unit">日</span><span class="bazi-sep">·</span>${lunarNow.getTimeInGanZhi()}<span class="bazi-unit">时</span>`;

        const plusBtn = headerRow.createEl('span', { text: '+', cls: 'floating-plus-btn' });
        this.plusMenu = headerRow.createDiv({ cls: 'plus-dropdown' });
        this.renderActionsInMenu();

        plusBtn.onclick = (e) => {
            e.stopPropagation();
            this.plusMenu.toggleClass('is-open', !this.plusMenu.hasClass('is-open'));
        };

        // 彻底修复内存泄漏：建立安全绑定的全局监听器机制
        this.globalClickListener = () => { if(this.plusMenu) this.plusMenu.removeClass('is-open'); };
        this.containerEl.doc.addEventListener('click', this.globalClickListener);

        const gridContainer = container.createDiv({ cls: 'desktop-grid-container' });
        
        const leftPanel = gridContainer.createDiv({ cls: 'glass-card calendar-panel' });
        this.boardArea = leftPanel.createDiv({ cls: 'heatmap-calendar-wrapper' });

        const rightPanel = gridContainer.createDiv({ cls: 'glass-card list-panel' });
        const chartHeader = rightPanel.createDiv({ cls: 'chart-header-row' });
        chartHeader.createEl('span', { text: '足迹回顾', cls: 'chart-title' });

        this.listWrapper = rightPanel.createDiv({ cls: 'record-list-wrapper' });
        this.listHeader = this.listWrapper.createDiv({ cls: 'record-list-header' });
        this.listScrollArea = this.listWrapper.createDiv({ cls: 'record-list-scroll' });

        this.renderCalendar('none');
    }

    renderActionsInMenu() {
        this.plusMenu.empty();
        this.plugin.settings.actions.forEach(action => {
            if (!action.name) return;
            const item = this.plusMenu.createDiv({ cls: 'dropdown-item', text: action.name });
            item.onclick = () => { 
                this.plusMenu.removeClass('is-open'); 
                this.promptNewNote(action); 
            };
        });
    }

    buildFileDataMap() {
        this.fileDataMap = {};
        this.app.vault.getMarkdownFiles().forEach(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            const formatKey = this.extractDateFromFile(file, cache);
            
            if (!this.fileDataMap[formatKey]) this.fileDataMap[formatKey] = [];
            this.fileDataMap[formatKey].push(file);
        });
        
        for (const key in this.fileDataMap) { 
            this.fileDataMap[key].sort((a, b) => b.stat.ctime - a.stat.ctime); 
        }
    }

    extractDateFromFile(file: TFile, cache: any): string {
        let dateStr: string | null = null;
        let yearContext = moment(file.stat.ctime).year(); 
        
        const pathYearMatch = file.path.match(/(20\d{2})/);
        if (pathYearMatch) {
            yearContext = parseInt(pathYearMatch[1]);
        }

        if (cache?.frontmatter?.date) {
            dateStr = String(cache.frontmatter.date).trim();
            const parsed = this.parseLenientDate(dateStr, yearContext);
            if (parsed) return parsed;
        }

        dateStr = file.basename.trim();
        const parsedFilename = this.parseLenientDate(dateStr, yearContext);
        if (parsedFilename) return parsedFilename;

        return moment(file.stat.ctime).format('YYYY-MM-DD');
    }

    parseLenientDate(s: string, defaultYear: number): string | null {
        s = s.trim();

        let m = moment(s, ["YYYY-MM-DD", "YYYY/MM/DD", "YYYY.MM.DD", "YYYY-MM-DDTHH:mm"], true);
        if (m.isValid()) return m.format('YYYY-MM-DD');

        let mmddMatch = s.match(/^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[^\d]|$)/);
        if (mmddMatch) {
            let mth = parseInt(mmddMatch[1]);
            let d = parseInt(mmddMatch[2]);
            return moment(`${defaultYear}-${mth}-${d}`, "YYYY-M-D").format('YYYY-MM-DD');
        }

        let complexMatch = s.match(/(?:^|[^\d])((?:20)?\d{2})[-./年_]?([0-1]?\d)[-./月_]?([0-3]?\d)日?(?:[^\d]|$)/);
        if (complexMatch) {
            let y = parseInt(complexMatch[1]);
            let mth = parseInt(complexMatch[2]);
            let d = parseInt(complexMatch[3]);
            if (y > 0 && y < 100) y += 2000; 
            if (mth >= 1 && mth <= 12 && d >= 1 && d <= 31) {
                return moment(`${y}-${mth}-${d}`, "YYYY-M-D").format('YYYY-MM-DD');
            }
        }
        
        let lenientMatch = s.match(/(?:^|[^\d])(2\d)[-./年_]?([1-9]|1[0-2])[-./月_]?([1-9]|[12]\d|3[01])日?(?:[^\d]|$)/);
        if (lenientMatch) {
            let y = parseInt(lenientMatch[1]) + 2000;
            let mth = parseInt(lenientMatch[2]);
            let d = parseInt(lenientMatch[3]);
            return moment(`${y}-${mth}-${d}`, "YYYY-M-D").format('YYYY-MM-DD');
        }

        return null;
    }

    renderCalendar(direction: 'left' | 'right' | 'none' = 'none') {
        this.boardArea.empty();
        
        const year = this.currentMonth.year();
        const month = this.currentMonth.month();
        const firstDay = moment([year, month, 1]).day();

        const nav = this.boardArea.createDiv({ cls: 'month-nav' });
        nav.createEl('span', { text: '‹', cls: 'month-nav-btn back-arrow' }).onclick = () => { this.currentMonth.subtract(1, 'M'); this.renderCalendar('left'); };
        nav.createSpan({ text: this.currentMonth.format('YYYY年 M月'), cls: 'month-label' });
        nav.createEl('span', { text: '›', cls: 'month-nav-btn next-arrow' }).onclick = () => { this.currentMonth.add(1, 'M'); this.renderCalendar('right'); };

        const animWrapper = this.boardArea.createDiv({ cls: 'calendar-anim-wrapper' });
        if (direction === 'left') animWrapper.addClass('slide-in-left');
        if (direction === 'right') animWrapper.addClass('slide-in-right');

        const weekdaysGrid = animWrapper.createDiv({ cls: 'calendar-weekdays' });
        ['日', '一', '二', '三', '四', '五', '六'].forEach(day => weekdaysGrid.createDiv({ text: day }));

        const grid = animWrapper.createDiv({ cls: 'calendar-grid' });
        for (let i = 0; i < firstDay; i++) grid.createDiv({ cls: 'calendar-cell empty' });

        for (let day = 1; day <= this.currentMonth.daysInMonth(); day++) {
            const dateKey = moment([year, month, day]).format('YYYY-MM-DD');
            const files = this.fileDataMap[dateKey] || [];
            const count = files.length;

            const cell = grid.createDiv({ cls: 'calendar-cell' });
            
            const d = new Date(year, month, day);
            const lunar = Lunar.fromDate(d);
            const lunarDayStr = lunar.getDay() === 1 ? lunar.getMonthInChinese() + '月' : lunar.getDayInChinese();
            
            cell.createDiv({ text: day.toString(), cls: 'cal-date-num' });
            cell.createDiv({ text: lunarDayStr, cls: 'cal-lunar-text' });

            if (count > 0) {
                cell.addClass('has-data');
                cell.addClass(`level-${Math.min(count, 4)}`);
            }

            if (dateKey === moment().format('YYYY-MM-DD')) {
                cell.addClass('active-selection');
                this.triggerListAnimation(dateKey, files, lunar);
            }

            cell.onclick = () => {
                grid.querySelectorAll('.calendar-cell').forEach(el => el.removeClass('active-selection'));
                cell.addClass('active-selection');
                this.triggerListAnimation(dateKey, files, lunar);
            };
        }
    }

    triggerListAnimation(dateStr: string, files: TFile[], lunar: Lunar) {
        this.listScrollArea.empty();
        const baziDay = `${lunar.getYearInGanZhi()}年 · ${lunar.getMonthInGanZhi()}月 · ${lunar.getDayInGanZhi()}日`;

        if (files.length === 0) { 
            this.listHeader.innerHTML = `
                <div class="record-list-date">${dateStr}</div>
                <div class="record-list-lunar">${baziDay}</div>
            `;
            
            const emptyState = this.listScrollArea.createDiv({ cls: 'empty-state-container' });
            emptyState.innerHTML = `
                <div class="empty-state-svg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                        <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
                    </svg>
                </div>
                <div class="empty-state-text">今日暂无足迹 · 喝杯茶休息一下</div>
            `;
            
            this.listWrapper.style.maxHeight = '1000px';
            this.listWrapper.style.opacity = '1';
            return; 
        }
        
        this.listHeader.innerHTML = `
            <div class="record-list-date">${dateStr} <span class="record-list-count">${files.length} 篇</span></div>
            <div class="record-list-lunar">${baziDay}</div>
        `;
        
        files.forEach((file, index) => {
            const item = this.listScrollArea.createDiv({ cls: 'record-item' });
            item.style.animationDelay = `${index * 0.06}s`;
            
            const iconWrap = item.createDiv({ cls: 'record-icon' });
            iconWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>`;
            
            item.createDiv({ text: file.basename, cls: 'record-title' });
            
            // 彻底修复：点击回调异步封装
            item.onclick = () => {
                void (async () => {
                    await this.app.workspace.getLeaf('tab').openFile(file);
                })();
            };
        });
        this.listWrapper.style.maxHeight = '1000px';
        this.listWrapper.style.opacity = '1';
    }

    promptNewNote(config: ActionConfig) {
        new QuickNoteModal(this.app, config, (title, date, folderPath) => {
            void (async () => {
                const selectedDate = moment(date).toDate();
                selectedDate.setHours(new Date().getHours()); 
                const lunarFull = Lunar.fromDate(selectedDate);
                const baziFullStr = `${lunarFull.getYearInGanZhi()}年 ${lunarFull.getMonthInGanZhi()}月 ${lunarFull.getDayInGanZhi()}日 ${lunarFull.getTimeInGanZhi()}时`;

                const parsedContent = config.template
                    .replace(/\{\{DATE\}\}/g, date)
                    .replace(/\{\{TITLE\}\}/g, title)
                    .replace(/\{\{BAZI\}\}/g, baziFullStr);

                await this.ensureFolder(folderPath);
                const fileName = `${folderPath}/${title}.md`;
                try {
                    const file = await this.app.vault.create(fileName, parsedContent);
                    await this.app.workspace.getLeaf('tab').openFile(file);
                } catch (e) { console.error("创建失败", e); }
            })();
        }).open();
    }

    async ensureFolder(path: string) {
        const folders = path.split('/');
        let currentPath = "";
        for (const folder of folders) {
            currentPath += (currentPath === "" ? "" : "/") + folder;
            if (!(this.app.vault.getAbstractFileByPath(currentPath) instanceof TFolder)) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    async onClose() {
        // 彻底释放内存，防止视图关闭后事件堆积
        if (this.globalClickListener) {
            this.containerEl.doc.removeEventListener('click', this.globalClickListener);
            this.globalClickListener = null;
        }
    }
}

class QuickNoteModal extends Modal {
    title: string = ""; 
    date: string = moment().format('YYYY-MM-DD');
    folderPath: string = ""; 
    actionConfig: ActionConfig;
    onSubmit: (title: string, date: string, folder: string) => void;
    
    constructor(app: App, config: ActionConfig, onSubmit: (title: string, date: string, folder: string) => void) { 
        super(app); 
        this.actionConfig = config;
        this.onSubmit = onSubmit; 
        this.title = `${moment().format('MMDD')}-`; 
        this.folderPath = config.folder.replace(/\{\{YYYY\}\}/g, moment().format('YYYY')).replace(/\{\{MM\}\}/g, moment().format('MM'));
    }
    
    onOpen() {
        const { contentEl, modalEl, containerEl } = this;
        
        containerEl.addClass('ios-glass-modal-container');
        modalEl.addClass('ios-glass-modal');
        
        contentEl.createEl('h3', { text: this.actionConfig.name });
        
        new Setting(contentEl).setName('记录标题').addText(text => { text.setValue(this.title); text.onChange(value => this.title = value); });
        new Setting(contentEl).setName('归档日期').addText(text => { text.setValue(this.date); text.onChange(value => this.date = value); });
        
        new Setting(contentEl).setName('归档路径 (点击查看已有文件夹)').addText(text => { 
            text.setValue(this.folderPath); 
            text.onChange(value => this.folderPath = value); 
            
            const inputEl = text.inputEl;
            const settingControl = inputEl.parentElement;
            
            if(settingControl) {
                const suggestWrapper = settingControl.createDiv({ cls: 'folder-suggest-wrapper' });
                const allFolders = this.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder && f.path !== '/') as TFolder[];

                const showSuggestions = () => {
                    suggestWrapper.empty();
                    const query = inputEl.value.toLowerCase();
                    const matches = allFolders.filter(f => f.path.toLowerCase().includes(query)).slice(0, 30); 

                    if (matches.length > 0) {
                        suggestWrapper.addClass('is-open');
                        matches.forEach(folder => {
                            const item = suggestWrapper.createDiv({ cls: 'suggest-item', text: folder.path });
                            item.onmousedown = (e) => { 
                                e.preventDefault();
                                inputEl.value = folder.path;
                                this.folderPath = folder.path;
                                suggestWrapper.removeClass('is-open');
                                inputEl.dispatchEvent(new Event('input'));
                            };
                        });
                        setTimeout(() => { settingControl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
                    } else { suggestWrapper.removeClass('is-open'); }
                };

                inputEl.addEventListener('click', showSuggestions);
                inputEl.addEventListener('input', showSuggestions);
                inputEl.addEventListener('focus', showSuggestions);
                inputEl.addEventListener('blur', () => { setTimeout(() => suggestWrapper.removeClass('is-open'), 200); }); 
            }
        });
        
        new Setting(contentEl).addButton(btn => btn.setButtonText('确认创建').onClick(() => { 
            if (!this.title || !this.folderPath) return; 
            this.close(); 
            this.onSubmit(this.title, this.date, this.folderPath); 
        }));
    }
}

class DashboardSettingTab extends PluginSettingTab {
    plugin: DashboardPlugin;
    constructor(app: App, plugin: DashboardPlugin) { super(app, plugin); this.plugin = plugin; }
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: '控制中心设置' });
        
        new Setting(containerEl).setName('设为开屏主页 (打开时启动)')
            .setDesc('每次打开 Obsidian 时，将默认的新建空白页替换为控制中心。')
            .addToggle(toggle => toggle.setValue(this.plugin.settings.openOnStartup).onChange(async (val) => { this.plugin.settings.openOnStartup = val; await this.plugin.saveSettings(); }));
        
        containerEl.createEl('h3', { text: '新建类型管理' });
        containerEl.createEl('p', { text: '支持的模板变量: {{DATE}}, {{TITLE}}, {{BAZI}} (生成: 丙午年 癸巳月 辛巳日 丙申时)', cls: 'setting-item-description' });

        this.plugin.settings.actions.forEach((action, index) => {
            containerEl.createEl('h4', { text: `类型 ${index + 1}` });
            new Setting(containerEl).setName('名称 (留空隐藏)').addText(text => text.setValue(action.name).onChange(async (val) => { action.name = val; await this.plugin.saveSettings(); }));
            new Setting(containerEl).setName('保存文件夹').addText(text => text.setValue(action.folder).onChange(async (val) => { action.folder = val; await this.plugin.saveSettings(); }));
            new Setting(containerEl).setName('默认模板').addTextArea(text => { text.setValue(action.template).onChange(async (val) => { action.template = val; await this.plugin.saveSettings(); }); text.inputEl.rows = 5; });
        });
    }
}
