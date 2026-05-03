/**
 * @fileoverview Accessibility utilities for ElectIQ.
 * Implements screen reader announcements, focus trapping, keyboard navigation,
 * and motion preference detection per WCAG 2.1 AA requirements.
 * @module utils/accessibility
 */

/**
 * Announces a message to screen readers via the live region.
 * Clears then sets content after a brief delay to ensure the announcement is picked up.
 *
 * @param {string} message - The message to announce.
 * @param {'polite'|'assertive'} [priority='polite'] - Urgency level.
 */
export function announceToScreenReader(message, priority = 'polite') {
  const announcer = document.getElementById('sr-announcer');
  if (!announcer) return;

  announcer.setAttribute('aria-live', priority);
  announcer.textContent = '';
  setTimeout(() => {
    announcer.textContent = message;
  }, 100);
}

/**
 * Creates a focus trap within a container element.
 * Used for modals, chat panels, and other overlay components.
 *
 * @param {HTMLElement} container - The container to trap focus within.
 * @returns {{activate: Function, deactivate: Function}} Trap controller.
 */
export function createFocusTrap(container) {
  const FOCUSABLE_SELECTOR = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'textarea:not([disabled])', 'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  let previousFocus = null;

  /** @param {KeyboardEvent} e */
  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;

    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return {
    /** Activates the focus trap, saving current focus. */
    activate() {
      previousFocus = document.activeElement;
      container.addEventListener('keydown', handleKeyDown);

      // Focus first focusable element
      const focusable = container.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        /** @type {HTMLElement} */ (focusable[0]).focus();
      }
    },

    /** Deactivates the trap and restores previous focus. */
    deactivate() {
      container.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && /** @type {HTMLElement} */ (previousFocus).focus) {
        /** @type {HTMLElement} */ (previousFocus).focus();
      }
    }
  };
}

/**
 * Detects if the user prefers reduced motion.
 *
 * @returns {boolean} True if user prefers reduced motion.
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Sets up keyboard navigation for a list of items.
 * Supports arrow keys for navigation and Enter/Space for activation.
 *
 * @param {HTMLElement} container - Container with focusable children.
 * @param {string} itemSelector - CSS selector for navigable items.
 * @param {Function} [onActivate] - Callback when item is activated.
 */
export function setupKeyboardNav(container, itemSelector, onActivate) {
  container.addEventListener('keydown', (e) => {
    const items = Array.from(container.querySelectorAll(itemSelector));
    const currentIndex = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));

    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onActivate && currentIndex >= 0) {
          onActivate(items[currentIndex], currentIndex);
        }
        return;
    }

    if (nextIndex >= 0 && items[nextIndex]) {
      /** @type {HTMLElement} */ (items[nextIndex]).focus();
    }
  });
}

/**
 * Initializes the skip-to-content link behavior.
 */
export function initSkipNav() {
  const skipLink = document.getElementById('skip-nav');
  if (!skipLink) return;

  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const main = document.getElementById('main-content');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      main.removeAttribute('tabindex');
    }
  });
}

/**
 * Observes theme preference changes and dispatches a custom event.
 *
 * @param {Function} callback - Called with 'dark' or 'light'.
 */
export function watchColorScheme(callback) {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => callback(e.matches ? 'dark' : 'light');
  query.addEventListener('change', handler);
  handler(query); // Call once with initial value
}
