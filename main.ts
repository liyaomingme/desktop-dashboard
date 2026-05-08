import { Plugin, WorkspaceLeaf, ItemView, TFolder, Modal, Setting, PluginSettingTab, App, TFile, moment } from 'obsidian';
import { Lunar } from 'lunar-javascript';

const VIEW_TYPE_DASHBOARD = "mobile-dashboard-view";

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
        this.addRibbonIcon('layout-dashboard', '控制中心', () => this.activateView());
        this.addCommand({ id: 'show-dashboard', name: '显示控制中心', callback: () => this.activateView() });
        this.addSettingTab(new DashboardSettingTab(this.app, this));
        this.app.workspace.onLayoutReady(() => { if (this.settings.openOnStartup) this.activateView(); });
    }
    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() { await this.saveData(this.settings); }
    async activateView() {
        let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];
        if (!leaf) {
            leaf = this.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
        }
        this.app.workspace.revealLeaf(leaf);
    }
}

class DashboardView extends ItemView {
    plugin: DashboardPlugin;
    currentMonth: any;
    fileDataMap: Record<string, TFile[]> = {};
    
    calendarContainer: HTMLElement;
    listWrapper: HTMLElement;
    listScrollArea: HTMLElement;
    listHeader: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: DashboardPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentMonth = moment().startOf('month');
    }

    getViewType() { return VIEW_TYPE_DASHBOARD; }
    getDisplayText() { return "控制中心"; }
    getIcon() { return "layout-dashboard"; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('dashboard-container');

        this.buildFileDataMap();

        const headerRow = container.createDiv({ cls: 'dashboard-header-row' });
        const header = headerRow.createDiv({ cls: 'baseline-header' });
        header.createDiv({ text: moment().format('M月D日 dddd'), cls: 'baseline-date' });
        const now = new Date();
        const bazi = Lunar.fromDate(now);
        const baziStr = `${bazi.getYearInGanZhi()}年 · ${bazi.getMonthInGanZhi()}月 · ${bazi.getDayInGanZhi()}日 · ${bazi.getTimeInGanZhi()}时`;
        header.createEl('h1', { text: baziStr, cls: 'baseline-title bazi-title' });

        const plusBtn = headerRow.createEl('span', { text: '+', cls: 'floating-plus-btn' });
        plusBtn.onclick = () => this.showActionMenu(plusBtn);

        const mainContent = container.createDiv({ cls: 'dashboard-main-content' });

        const calSection = mainContent.createDiv({ cls: 'dashboard-data-section' });
        this.calendarContainer = calSection.createDiv({ cls: 'heatmap-calendar-wrapper' });

        this.listWrapper = mainContent.createDiv({ cls: 'record-list-wrapper' });
        this.listHeader = this.listWrapper.createDiv({ cls: 'record-list-header' });
        this.listScrollArea = this.listWrapper.createDiv({ cls: 'record-list-scroll' });

        this.renderCalendar('none');
    }

    showActionMenu(anchor: HTMLElement) {
        const menu = this.containerEl.createDiv({ cls: 'plus-dropdown is-open' });
        this.plugin.settings.actions.forEach(action => {
            const item = menu.createDiv({ cls: 'dropdown-item', text: action.name });
            item.onclick = () => { menu.remove(); this.promptNewNote(action); };
        });
        const closeMenu = (e: MouseEvent) => { if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }

    buildFileDataMap() {
        this.fileDataMap = {};
        this.app.vault.getMarkdownFiles().forEach(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            const dateStr = cache?.frontmatter?.date || moment(file.stat.ctime).format('YYYY-MM-DD');
            const key = moment(dateStr).format('YYYY-MM-DD');
            if (!this.fileDataMap[key]) this.fileDataMap[key] = [];
            this.fileDataMap[key].push(file);
        });
    }

    renderCalendar(dir: 'left' | 'right' | 'none') {
        this.calendarContainer.empty();
        const year = this.currentMonth.year();
        const month = this.currentMonth.month();
        const firstDay = moment([year, month, 1]).day();

        const nav = this.calendarContainer.createDiv({ cls: 'month-nav' });
        nav.createEl('span', { text: '‹', cls: 'month-nav-btn back-arrow' }).onclick = () => { this.currentMonth.subtract(1, 'M'); this.renderCalendar('left'); };
        nav.createSpan({ text: this.currentMonth.format('YYYY年 M月'), cls: 'month-label' });
        nav.createEl('span', { text: '›', cls: 'month-nav-btn next-arrow' }).onclick = () => { this.currentMonth.add(1, 'M'); this.renderCalendar('right'); };

        const animWrapper = this.calendarContainer.createDiv({ cls: 'calendar-anim-wrapper' });
        if (dir === 'left') animWrapper.addClass('slide-in-left');
        if (dir === 'right') animWrapper.addClass('slide-in-right');

        const grid = animWrapper.createDiv({ cls: 'calendar-grid' });
        ['日','一','二','三','四','五','六'].forEach(d => grid.createDiv({ text: d, cls: 'calendar-weekdays' }));
        
        for (let i = 0; i < firstDay; i++) grid.createDiv({ cls: 'calendar-cell empty' });
        
        for (let d = 1; d <= this.currentMonth.daysInMonth(); d++) {
            const dateKey = moment([year, month, d]).format('YYYY-MM-DD');
            const files = this.fileDataMap[dateKey] || [];
            const cell = grid.createDiv({ cls: 'calendar-cell' });
            if (files.length > 0) cell.addClass(`level-${Math.min(files.length, 4)}`);
            
            const lunar = Lunar.fromDate(moment([year, month, d]).toDate());
            cell.createDiv({ text: d.toString(), cls: 'cal-date-num' });
            cell.createDiv({ text: lunar.getDay() === 1 ? lunar.getMonthInChinese() + '月' : lunar.getDayInChinese(), cls: 'cal-lunar-text' });
            
            cell.onclick = () => {
                this.calendarContainer.findAll('.active-selection').forEach(el => el.removeClass('active-selection'));
                cell.addClass('active-selection');
                this.showList(dateKey, files, lunar);
            };
        }
    }

    showList(date: string, files: TFile[], lunar: Lunar) {
        this.listScrollArea.empty();
        this.listWrapper.addClass('is-open');
        this.listHeader.innerHTML = `<div class="record-list-date">${date} <span class="record-list-count">${files.length} 篇</span></div>
                                     <div class="record-list-lunar">${lunar.getYearInGanZhi()}年 · ${lunar.getMonthInGanZhi()}月 · ${lunar.getDayInGanZhi()}日</div>`;
        
        files.forEach(f => {
            const item = this.listScrollArea.createDiv({ cls: 'record-item' });
            item.createDiv({ text: '📄', cls: 'record-icon' });
            item.createDiv({ text: f.basename, cls: 'record-title' });
            item.onclick = () => this.app.workspace.getLeaf(true).openFile(f);
        });
    }

    async promptNewNote(config: ActionConfig) {
        new QuickNoteModal(this.app, config, async (title, date, folder) => {
            const fullDate = moment(date).toDate();
            fullDate.setHours(new Date().getHours());
            const l = Lunar.fromDate(fullDate);
            const bazi = `${l.getYearInGanZhi()}年 ${l.getMonthInGanZhi()}月 ${l.getDayInGanZhi()}日 ${l.getTimeInGanZhi()}时`;
            
            const content = config.template.replace(/\{\{DATE\}\}/g, date).replace(/\{\{BAZI\}\}/g, bazi);
            await this.ensureFolder(folder);
            const file = await this.app.vault.create(`${folder}/${title}.md`, content);
            this.app.workspace.getLeaf(true).openFile(file);
        }).open();
    }

    async ensureFolder(path: string) {
        let cur = "";
        for (const f of path.split('/')) {
            cur += (cur === "" ? "" : "/") + f;
            if (!this.app.vault.getAbstractFileByPath(cur)) await this.app.vault.createFolder(cur);
        }
    }
}

class QuickNoteModal extends Modal {
    title: string; date: string; folder: string; config: ActionConfig;
    onSubmit: (t: string, d: string, f: string) => void;

    constructor(app: App, config: ActionConfig, onSubmit: any) {
        super(app);
        this.config = config;
        this.onSubmit = onSubmit;
        this.title = moment().format('MMDD') + "-";
        this.date = moment().format('YYYY-MM-DD');
        this.folder = config.folder.replace(/\{\{YYYY\}\}/g, moment().format('YYYY')).replace(/\{\{MM\}\}/g, moment().format('MM'));
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        modalEl.addClass('ios-glass-modal');
        contentEl.createEl('h3', { text: this.config.name });

        new Setting(contentEl).setName('记录标题').addText(t => { t.setValue(this.title); t.onChange(v => this.title = v); });
        new Setting(contentEl).setName('归档日期').addText(t => { t.setValue(this.date); t.onChange(v => this.date = v); });
        
        const folderWrapper = contentEl.createDiv({ cls: 'folder-suggest-wrapper' });
        new Setting(contentEl).setName('保存路径 (点击查看)').addText(t => {
            t.setValue(this.folder);
            t.onChange(v => this.folder = v);
            t.inputEl.onclick = () => {
                folderWrapper.empty();
                folderWrapper.toggleClass('is-open', true);
                const folders = this.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder && f.path !== '/');
                folders.forEach(f => {
                    const item = folderWrapper.createDiv({ cls: 'suggest-item', text: f.path });
                    item.onclick = () => { t.setValue(f.path); this.folder = f.path; folderWrapper.removeClass('is-open'); };
                });
            };
        });

        const btn = contentEl.createEl('button', { text: '确认创建', cls: 'mod-cta' });
        btn.onclick = () => { this.close(); this.onSubmit(this.title, this.date, this.folder); };
    }
}

class DashboardSettingTab extends PluginSettingTab {
    plugin: DashboardPlugin;
    constructor(app: App, plugin: DashboardPlugin) { super(app, plugin); this.plugin = plugin; }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new Setting(containerEl).setName('启动时自动打开').addToggle(t => t.setValue(this.plugin.settings.openOnStartup).onChange(v => { this.plugin.settings.openOnStartup = v; this.plugin.saveSettings(); }));
        this.plugin.settings.actions.forEach((a, i) => {
            new Setting(containerEl).setName(`类型 ${i+1} 名称`).addText(t => t.setValue(a.name).onChange(v => { a.name = v; this.plugin.saveSettings(); }));
            new Setting(containerEl).setName(`保存路径`).addText(t => t.setValue(a.folder).onChange(v => { a.folder = v; this.plugin.saveSettings(); }));
            new Setting(containerEl).setName(`默认模板`).addTextArea(t => t.setValue(a.template).onChange(v => { a.template = v; this.plugin.saveSettings(); }));
        });
    }
}
