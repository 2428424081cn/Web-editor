/* ============================================
   ThemeService - 主题切换服务
   ============================================ */

class ThemeService {
  constructor() {
    this._currentTheme = 'light';
    this._availableThemes = ['light', 'dark'];
  }

  /**
   * 初始化主题
   */
  async init() {
    const saved = await window.storage.getSetting('theme');
    if (saved && this._availableThemes.includes(saved)) {
      this._currentTheme = saved;
    } else {
      // 检测系统偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this._currentTheme = prefersDark ? 'dark' : 'light';
    }
    this._apply();
  }

  /**
   * 切换主题
   */
  toggle() {
    const idx = this._availableThemes.indexOf(this._currentTheme);
    this._currentTheme = this._availableThemes[(idx + 1) % this._availableThemes.length];
    this._apply();
    window.storage.saveSetting('theme', this._currentTheme);
    window.eventBus.emit(EVENTS.THEME_CHANGED, this._currentTheme);
  }

  /**
   * 设置指定主题
   */
  setTheme(theme) {
    if (this._availableThemes.includes(theme)) {
      this._currentTheme = theme;
      this._apply();
      window.storage.saveSetting('theme', this._currentTheme);
      window.eventBus.emit(EVENTS.THEME_CHANGED, this._currentTheme);
    }
  }

  /**
   * 获取当前主题
   */
  get current() {
    return this._currentTheme;
  }

  /**
   * 获取主题显示名
   */
  get displayName() {
    return this._currentTheme === 'dark' ? '暗色' : '亮色';
  }

  /**
   * 应用主题
   */
  _apply() {
    document.documentElement.setAttribute('data-theme', this._currentTheme);

    // 更新主题切换按钮图标
    const sunIcon = document.querySelector('.icon-sun');
    const moonIcon = document.querySelector('.icon-moon');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = this._currentTheme === 'dark' ? 'none' : '';
      moonIcon.style.display = this._currentTheme === 'dark' ? '' : 'none';
    }

    // 更新状态栏
    const statusTheme = document.getElementById('statusTheme');
    if (statusTheme) {
      statusTheme.textContent = this.displayName;
    }
  }
}

// 全局单例
window.themeService = new ThemeService();
