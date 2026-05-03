/**
 * @fileoverview AI Chat Assistant Web Component for ElectIQ.
 * Streaming Gemini-powered chat with DOMPurify sanitization,
 * rate limiting UI, typing indicator, and full accessibility.
 * @module components/ChatAssistant
 */

import { sendMessage, getRemainingCalls, RateLimitError } from '../services/geminiService.js';
import { sanitizeHtml, sanitizeInput, validateInput } from '../utils/sanitize.js';
import { announceToScreenReader, createFocusTrap } from '../utils/accessibility.js';
import { trackQuestionAsked, trackResponseFeedback } from '../utils/analytics.js';

/**
 * ChatAssistant Web Component.
 * Fixed bottom-right chat bubble with expandable panel, streaming responses.
 *
 * @extends HTMLElement
 */
class ChatAssistant extends HTMLElement {
  constructor() {
    super();
    /** @type {Array<{role: string, content: string}>} */
    this.messages = [];
    /** @type {boolean} */
    this.isOpen = false;
    /** @type {boolean} */
    this.isLoading = false;
    /** @type {AbortController|null} */
    this.abortController = null;
    /** @type {Object|null} */
    this.focusTrap = null;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Renders the chat UI.
   */
  render() {
    this.innerHTML = `
      <!-- Chat Toggle Button -->
      <button class="chat-toggle" id="chat-toggle" aria-label="Open ElectIQ chat assistant" aria-expanded="false" aria-controls="chat-panel">
        <svg class="chat-toggle-icon chat-open-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" fill="currentColor"/>
          <circle cx="8" cy="10" r="1" fill="currentColor"/>
          <circle cx="12" cy="10" r="1" fill="currentColor"/>
          <circle cx="16" cy="10" r="1" fill="currentColor"/>
        </svg>
        <svg class="chat-toggle-icon chat-close-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
        </svg>
      </button>

      <!-- Chat Panel -->
      <div class="chat-panel" id="chat-panel" role="dialog" aria-labelledby="chat-title" aria-modal="true">
        <div class="chat-header">
          <span class="chat-header-dot" aria-hidden="true"></span>
          <span class="chat-header-title" id="chat-title">ElectIQ Assistant</span>
          <span class="chat-header-rate" id="chat-rate" aria-label="Remaining questions">${getRemainingCalls()} left</span>
        </div>

        <div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
          <div class="chat-welcome">
            <div class="chat-welcome-icon" aria-hidden="true">🇮🇳</div>
            <h3>Namaste! I'm ElectIQ</h3>
            <p style="font-size: var(--fs-sm); color: var(--color-text-muted);">
              Your non-partisan guide to Indian elections. Ask me anything about voting, EVM, registration, or election results.
            </p>
            <div class="chat-suggestions">
              <button class="chat-suggestion" data-suggestion="How do I register to vote in India?">How do I register to vote?</button>
              <button class="chat-suggestion" data-suggestion="How does an EVM machine work?">How does the EVM work?</button>
              <button class="chat-suggestion" data-suggestion="What is the Model Code of Conduct?">What is Model Code of Conduct?</button>
              <button class="chat-suggestion" data-suggestion="What documents do I need to vote?">What ID do I need to vote?</button>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <label for="chat-input" class="sr-only">Type your question about Indian elections</label>
          <textarea
            class="chat-input"
            id="chat-input"
            placeholder="Ask about Indian elections..."
            rows="1"
            maxlength="500"
            aria-label="Type your question about Indian elections"
          ></textarea>
          <button class="chat-send" id="chat-send" aria-label="Send message" disabled>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Sets up all event listeners.
   */
  setupEventListeners() {
    const toggle = this.querySelector('#chat-toggle');
    const panel = this.querySelector('#chat-panel');
    const input = this.querySelector('#chat-input');
    const sendBtn = this.querySelector('#chat-send');

    // Toggle chat panel
    toggle.addEventListener('click', () => this.toggleChat());

    // Send message
    sendBtn.addEventListener('click', () => this.handleSend());

    // Input handling
    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim();
      // Auto-resize textarea
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.value.trim()) this.handleSend();
      }
    });

    // Suggestion buttons
    this.querySelectorAll('.chat-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.suggestion;
        sendBtn.disabled = false;
        this.handleSend();
      });
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.toggleChat();
      }
    });

    // Setup focus trap
    this.focusTrap = createFocusTrap(panel);
  }

  /**
   * Toggles the chat panel open/closed.
   */
  toggleChat() {
    this.isOpen = !this.isOpen;
    const toggle = this.querySelector('#chat-toggle');
    const panel = this.querySelector('#chat-panel');

    toggle.classList.toggle('active', this.isOpen);
    panel.classList.toggle('open', this.isOpen);
    toggle.setAttribute('aria-expanded', String(this.isOpen));
    toggle.setAttribute('aria-label', this.isOpen ? 'Close chat assistant' : 'Open ElectIQ chat assistant');

    if (this.isOpen) {
      this.focusTrap.activate();
      announceToScreenReader('Chat assistant opened. Type your question about Indian elections.');
    } else {
      this.focusTrap.deactivate();
      announceToScreenReader('Chat assistant closed.');
    }
  }

  /**
   * Handles sending a message.
   */
  async handleSend() {
    const input = this.querySelector('#chat-input');
    const rawMessage = input.value.trim();
    if (!rawMessage || this.isLoading) return;

    // Validate and sanitize
    const { valid, sanitized, error } = validateInput(rawMessage);
    if (!valid) {
      this.showError(error);
      return;
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    this.querySelector('#chat-send').disabled = true;

    // Remove welcome message
    const welcome = this.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Add user message
    this.addMessage('user', sanitized);

    // Track analytics
    trackQuestionAsked(this.categorizeQuestion(sanitized));

    // Show typing indicator
    this.setLoading(true);

    try {
      // Create abort controller for cancellation
      this.abortController = new AbortController();

      // Add empty bot message for streaming
      const botMsgEl = this.addMessage('bot', '', true);
      const textEl = botMsgEl.querySelector('.msg-text');

      let fullResponse = '';

      // Stream the response
      for await (const chunk of sendMessage(sanitized, this.messages, { signal: this.abortController.signal })) {
        fullResponse += chunk;
        textEl.innerHTML = sanitizeHtml(fullResponse);
        this.scrollToBottom();
      }

      // Save to history
      this.messages.push({ role: 'user', content: sanitized });
      this.messages.push({ role: 'assistant', content: fullResponse });

      // Update rate counter
      this.querySelector('#chat-rate').textContent = `${getRemainingCalls()} left`;

      announceToScreenReader('Answer loaded. Use the message actions to copy or give feedback.');
    } catch (error) {
      if (error instanceof RateLimitError) {
        this.showError('You\'ve reached the hourly question limit. Please wait a while before asking more questions.');
      } else if (error.message === 'Request was cancelled.') {
        // User cancelled, no error needed
      } else {
        this.showError('Sorry, I couldn\'t process your question right now. Please try again.');
        console.error('[ChatAssistant] Error:', error);
      }
    } finally {
      this.setLoading(false);
      this.abortController = null;
    }
  }

  /**
   * Adds a message to the chat.
   *
   * @param {'user'|'bot'} role - Message role.
   * @param {string} content - Message content.
   * @param {boolean} [streaming=false] - Whether this is a streaming message.
   * @returns {HTMLElement} The message element.
   */
  addMessage(role, content, streaming = false) {
    const messagesEl = this.querySelector('#chat-messages');

    const msg = document.createElement('div');
    msg.className = `chat-msg chat-msg--${role}`;
    msg.setAttribute('role', 'article');
    msg.setAttribute('aria-label', `${role === 'user' ? 'You' : 'ElectIQ'} said`);

    if (role === 'bot') {
      msg.innerHTML = `
        <div class="msg-text">${content ? sanitizeHtml(content) : '<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>'}</div>
        ${!streaming ? `
          <div class="msg-actions">
            <button class="msg-action-btn" data-action="copy" aria-label="Copy response">📋 Copy</button>
            <button class="msg-action-btn" data-action="helpful" aria-label="This response was helpful">👍</button>
            <button class="msg-action-btn" data-action="unhelpful" aria-label="This response was not helpful">👎</button>
          </div>
        ` : ''}
      `;

      // Add action listeners after a delay (for streaming messages)
      if (!streaming) {
        this.setupMessageActions(msg, content);
      } else {
        // Will add actions after streaming completes
        const observer = new MutationObserver(() => {
          const text = msg.querySelector('.msg-text').textContent;
          if (text && !msg.querySelector('.msg-actions')) {
            const actions = document.createElement('div');
            actions.className = 'msg-actions';
            actions.innerHTML = `
              <button class="msg-action-btn" data-action="copy" aria-label="Copy response">📋 Copy</button>
              <button class="msg-action-btn" data-action="helpful" aria-label="This response was helpful">👍</button>
              <button class="msg-action-btn" data-action="unhelpful" aria-label="This response was not helpful">👎</button>
            `;
            msg.appendChild(actions);
            this.setupMessageActions(msg, msg.querySelector('.msg-text').textContent);
            observer.disconnect();
          }
        });
        // Check after streaming is likely done
        setTimeout(() => {
          if (!msg.querySelector('.msg-actions')) {
            const actions = document.createElement('div');
            actions.className = 'msg-actions';
            actions.innerHTML = `
              <button class="msg-action-btn" data-action="copy" aria-label="Copy response">📋 Copy</button>
              <button class="msg-action-btn" data-action="helpful" aria-label="This response was helpful">👍</button>
              <button class="msg-action-btn" data-action="unhelpful" aria-label="This response was not helpful">👎</button>
            `;
            msg.appendChild(actions);
            this.setupMessageActions(msg, msg.querySelector('.msg-text').textContent);
          }
        }, 15000);
      }
    } else {
      msg.textContent = content;
    }

    messagesEl.appendChild(msg);
    this.scrollToBottom();

    return msg;
  }

  /**
   * Sets up action button listeners for a message.
   * @param {HTMLElement} msgEl - Message element.
   * @param {string} content - Message text content.
   */
  setupMessageActions(msgEl, content) {
    msgEl.querySelectorAll('.msg-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'copy') {
          navigator.clipboard.writeText(content).then(() => {
            btn.textContent = '✅ Copied';
            announceToScreenReader('Response copied to clipboard');
            setTimeout(() => { btn.innerHTML = '📋 Copy'; }, 2000);
          });
        } else if (action === 'helpful') {
          trackResponseFeedback(true, 'general');
          btn.textContent = '👍 Thanks!';
          btn.disabled = true;
          announceToScreenReader('Thank you for your feedback');
        } else if (action === 'unhelpful') {
          trackResponseFeedback(false, 'general');
          btn.textContent = '👎 Noted';
          btn.disabled = true;
          announceToScreenReader('Feedback recorded. We will improve.');
        }
      });
    });
  }

  /**
   * Shows an error message in the chat.
   * @param {string} message - Error message.
   */
  showError(message) {
    const messagesEl = this.querySelector('#chat-messages');
    const errorEl = document.createElement('div');
    errorEl.className = 'chat-msg chat-msg--bot';
    errorEl.style.borderColor = 'var(--color-danger)';
    errorEl.innerHTML = `<div class="msg-text" style="color: var(--color-danger);">⚠️ ${sanitizeHtml(message)}</div>`;
    messagesEl.appendChild(errorEl);
    this.scrollToBottom();
    announceToScreenReader(message);
  }

  /**
   * Sets loading state with typing indicator.
   * @param {boolean} loading - Whether loading.
   */
  setLoading(loading) {
    this.isLoading = loading;
    this.querySelector('#chat-input').disabled = loading;
  }

  /**
   * Scrolls messages to bottom.
   */
  scrollToBottom() {
    const el = this.querySelector('#chat-messages');
    el.scrollTop = el.scrollHeight;
  }

  /**
   * Categorizes a question for analytics.
   * @param {string} question - The user's question.
   * @returns {string} Category.
   */
  categorizeQuestion(question) {
    const lower = question.toLowerCase();
    if (lower.match(/register|voter id|epic|nvsp|enroll/)) return 'requirements';
    if (lower.match(/date|when|deadline|schedule|timeline/)) return 'timeline';
    if (lower.match(/evm|vote|booth|ballot|nota|vvpat/)) return 'process';
    return 'general';
  }
}

customElements.define('chat-assistant', ChatAssistant);
export default ChatAssistant;
