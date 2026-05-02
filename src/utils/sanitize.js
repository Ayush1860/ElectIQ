/**
 * @fileoverview DOMPurify sanitization wrapper for ElectIQ.
 * Sanitizes all user inputs before API calls and all API responses before rendering.
 * @module utils/sanitize
 */

/**
 * DOMPurify configuration — strict allowlist for safe HTML rendering.
 * @constant {Object}
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
    'h3', 'h4', 'h5', 'a', 'span', 'div', 'blockquote', 'code', 'pre'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'aria-label'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
};

/**
 * Plain text config — strips ALL HTML, returns only text content.
 * Used for sanitizing user chat inputs before sending to Gemini API.
 * @constant {Object}
 */
const PLAINTEXT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: []
};

/**
 * Sanitizes HTML content for safe rendering in the DOM.
 * Allows a limited set of formatting tags.
 *
 * @param {string} dirtyHtml - The potentially unsafe HTML string.
 * @returns {string} Sanitized HTML string safe for innerHTML.
 *
 * @example
 * const safe = sanitizeHtml('<p>Hello</p><script>alert("xss")</script>');
 * // Returns: '<p>Hello</p>'
 */
export function sanitizeHtml(dirtyHtml) {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  if (typeof DOMPurify === 'undefined') {
    console.warn('[ElectIQ:sanitize] DOMPurify not loaded, falling back to text-only');
    return escapeHtml(dirtyHtml);
  }

  const clean = DOMPurify.sanitize(dirtyHtml, PURIFY_CONFIG);

  // Force all links to open in new tab with noopener
  const temp = document.createElement('div');
  temp.innerHTML = clean;
  temp.querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  return temp.innerHTML;
}

/**
 * Sanitizes user input to plain text — strips all HTML tags.
 * Used before sending user messages to the Gemini API proxy.
 *
 * @param {string} input - Raw user input string.
 * @returns {string} Plain text with no HTML.
 *
 * @example
 * const text = sanitizeInput('<b>How</b> do I vote?');
 * // Returns: 'How do I vote?'
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';

  if (typeof DOMPurify === 'undefined') {
    return escapeHtml(input);
  }

  return DOMPurify.sanitize(input, PLAINTEXT_CONFIG).trim();
}

/**
 * Escapes HTML special characters as a fallback when DOMPurify is unavailable.
 *
 * @param {string} text - The text to escape.
 * @returns {string} HTML-escaped string.
 */
export function escapeHtml(text) {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  return String(text).replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * Validates that a string doesn't exceed maximum length.
 * Prevents abuse through extremely long inputs.
 *
 * @param {string} input - The input to validate.
 * @param {number} [maxLength=500] - Maximum allowed length.
 * @returns {{valid: boolean, sanitized: string, error: string|null}}
 */
export function validateInput(input, maxLength = 500) {
  const sanitized = sanitizeInput(input);

  if (sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Please enter a message.' };
  }

  if (sanitized.length > maxLength) {
    return {
      valid: false,
      sanitized: sanitized.substring(0, maxLength),
      error: `Message too long. Maximum ${maxLength} characters.`
    };
  }

  return { valid: true, sanitized, error: null };
}
