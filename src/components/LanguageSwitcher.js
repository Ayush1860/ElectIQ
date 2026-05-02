/**
 * @fileoverview Language Switcher Web Component for ElectIQ.
 * Provides a dropdown to switch UI language using Google Cloud Translation.
 * @module components/LanguageSwitcher
 */

import { SUPPORTED_LANGUAGES, setLanguage, getCurrentLanguage, detectBrowserLanguage } from '../services/translateService.js';
import { announceToScreenReader } from '../utils/accessibility.js';

/**
 * LanguageSwitcher Web Component.
 * @extends HTMLElement
 */
class LanguageSwitcher extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();

    // Auto-detect and set browser language
    const detected = detectBrowserLanguage();
    if (detected !== 'en') {
      setLanguage(detected);
      this.updateDisplay();
    }
  }

  /** Renders the component. */
  render() {
    const current = SUPPORTED_LANGUAGES.find(l => l.code === getCurrentLanguage()) || SUPPORTED_LANGUAGES[0];

    this.innerHTML = `
      <div class="lang-switcher">
        <button class="lang-trigger" id="lang-trigger"
                aria-expanded="false" aria-haspopup="listbox"
                aria-label="Change language. Current: ${current.label}">
          <span aria-hidden="true">${current.flag}</span>
          <span class="lang-current-label">${current.code.toUpperCase()}</span>
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
        <div class="lang-dropdown" id="lang-dropdown" role="listbox" aria-label="Select language">
          ${SUPPORTED_LANGUAGES.map(lang => `
            <button class="lang-option ${lang.code === getCurrentLanguage() ? 'active' : ''}"
                    role="option"
                    data-lang="${lang.code}"
                    aria-selected="${lang.code === getCurrentLanguage()}"
                    aria-label="${lang.label} (${lang.nativeLabel})">
              <span aria-hidden="true">${lang.flag}</span>
              <span>${lang.nativeLabel}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /** Sets up event listeners. */
  setupListeners() {
    const trigger = this.querySelector('#lang-trigger');
    const dropdown = this.querySelector('#lang-dropdown');

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOpen = !this.isOpen;
      dropdown.classList.toggle('open', this.isOpen);
      trigger.setAttribute('aria-expanded', String(this.isOpen));
    });

    // Language selection
    this.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const langCode = opt.dataset.lang;
        setLanguage(langCode);
        this.isOpen = false;
        this.render();
        this.setupListeners();
        announceToScreenReader(`Language changed to ${opt.getAttribute('aria-label')}`);
      });
    });

    // Close on outside click
    document.addEventListener('click', () => {
      if (this.isOpen) {
        this.isOpen = false;
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Keyboard: Escape to close
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.isOpen = false;
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  }

  /** Updates the trigger display to match current language. */
  updateDisplay() {
    this.render();
    this.setupListeners();
  }
}

customElements.define('language-switcher', LanguageSwitcher);
export default LanguageSwitcher;
