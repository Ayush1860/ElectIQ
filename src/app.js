/**
 * @fileoverview Main application entry point for ElectIQ.
 * Registers Web Components, initializes Firebase, sets up routing,
 * handles dark mode, auth modals, and service worker registration.
 * @module app
 */

// ── Import Services ──
import { initFirebase, signInAnonymously, signInWithGoogle, signOut, onAuthStateChanged } from './services/firebaseService.js';
import { initAnalytics } from './utils/analytics.js';
import { initSkipNav, announceToScreenReader, createFocusTrap, watchColorScheme } from './utils/accessibility.js';

// ── Import Web Components ──
import './components/ElectionTimeline.js';
import './components/ChatAssistant.js';
import './components/PollingLocator.js';
import './components/QuizModule.js';
import './components/LanguageSwitcher.js';
import './components/ProgressTracker.js';
import './components/DeadlineCountdown.js';
import './components/ElectionCharts.js';

/**
 * Initializes the entire ElectIQ application.
 */
async function initApp() {
  try {
    // ── 1. Initialize Firebase ──
    const { analytics } = await initFirebase();
    initAnalytics(analytics);

    // ── 2. Sign in anonymously by default ──
    await signInAnonymously();

    // ── 3. Initialize accessibility features ──
    initSkipNav();

    // ── 4. Setup dark mode ──
    setupDarkMode();

    // ── 5. Setup navigation ──
    setupNavigation();

    // ── 6. Setup auth modal ──
    setupAuthModal();

    // ── 7. Setup topic cards ──
    setupTopicCards();

    // ── 8. Setup resource link tracking ──
    setupResourceTracking();

    // ── 9. Hide loader, show app ──
    const loader = document.getElementById('app-loader');
    const app = document.getElementById('app');
    if (loader) loader.classList.add('hidden');
    if (app) app.hidden = false;

    // Remove loader after animation
    setTimeout(() => { if (loader) loader.remove(); }, 500);

    // ── 10. Register Service Worker ──
    registerServiceWorker();

    // ── 11. Listen for auth state changes ──
    onAuthStateChanged(updateAuthUI);

    announceToScreenReader('ElectIQ is ready. Welcome to your election guide.');

  } catch (error) {
    console.error('[ElectIQ] Init failed:', error);
    // Show app anyway with degraded functionality
    const loader = document.getElementById('app-loader');
    const app = document.getElementById('app');
    if (loader) loader.classList.add('hidden');
    if (app) app.hidden = false;
  }
}

/**
 * Sets up dark mode toggle and system preference detection.
 */
function setupDarkMode() {
  const toggle = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('electiq-theme');

  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  } else {
    watchColorScheme((scheme) => {
      if (!localStorage.getItem('electiq-theme')) {
        document.documentElement.setAttribute('data-theme', scheme);
      }
    });
  }

  toggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('electiq-theme', next);
    announceToScreenReader(`${next === 'dark' ? 'Dark' : 'Light'} mode activated`);
  });
}

/**
 * Sets up SPA navigation between sections.
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  // Mobile nav toggle
  navToggle?.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Nav link clicks
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      const target = document.getElementById(section);

      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });

        // Update active state
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Close mobile menu
        navMenu?.classList.remove('open');
        navToggle?.setAttribute('aria-expanded', 'false');

        // Update URL hash
        history.pushState(null, '', `#${section}`);

        announceToScreenReader(`Navigated to ${link.textContent.trim()} section`);
      }
    });
  });

  // Hero CTA buttons
  document.getElementById('hero-chat-btn')?.addEventListener('click', () => {
    const chat = document.querySelector('chat-assistant');
    if (chat) {
      chat.toggleChat();
    }
  });

  // Scroll spy for active nav state
  const sections = document.querySelectorAll('.section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(l => {
          l.classList.toggle('active', l.dataset.section === id);
        });
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(s => observer.observe(s));

  // Handle initial hash
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 500);
    }
  }
}

/**
 * Sets up the auth modal with focus trapping.
 */
function setupAuthModal() {
  const authBtn = document.getElementById('auth-btn');
  const modal = document.getElementById('auth-modal');
  const closeBtn = document.getElementById('auth-modal-close');
  const googleBtn = document.getElementById('google-signin-btn');
  const anonBtn = document.getElementById('anon-signin-btn');

  if (!modal) return;

  const focusTrap = createFocusTrap(modal.querySelector('.modal-content'));

  /** Opens the modal. */
  function openModal() {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    focusTrap.activate();
    announceToScreenReader('Sign in dialog opened');
  }

  /** Closes the modal. */
  function closeModal() {
    modal.classList.remove('open');
    setTimeout(() => { modal.hidden = true; }, 300);
    focusTrap.deactivate();
  }

  authBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  googleBtn?.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
      closeModal();
      announceToScreenReader('Signed in with Google successfully');
    } catch (err) {
      console.error('[Auth] Google sign-in failed:', err);
      announceToScreenReader('Sign in failed. Please try again.');
    }
  });

  anonBtn?.addEventListener('click', async () => {
    try {
      await signInAnonymously();
      closeModal();
      announceToScreenReader('Continuing as guest');
    } catch (err) {
      console.error('[Auth] Anonymous sign-in failed:', err);
    }
  });
}

/**
 * Updates auth UI based on user state.
 * @param {Object|null} user - Firebase user.
 */
function updateAuthUI(user) {
  const authBtn = document.getElementById('auth-btn');
  const authLabel = authBtn?.querySelector('.auth-label');

  if (user && !user.isAnonymous) {
    if (authLabel) authLabel.textContent = user.displayName || 'Account';
    authBtn?.setAttribute('aria-label', `Signed in as ${user.displayName || 'user'}`);

    // Change click to sign out
    authBtn?.removeEventListener('click', null);
    authBtn?.addEventListener('click', async () => {
      await signOut();
      await signInAnonymously();
      announceToScreenReader('Signed out successfully');
    });
  } else {
    if (authLabel) authLabel.textContent = 'Sign In';
    authBtn?.setAttribute('aria-label', 'Sign in to save progress');
  }
}

/**
 * Sets up topic card click handlers.
 */
function setupTopicCards() {
  document.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', () => {
      const topic = card.dataset.topic;
      // Open chat with topic question
      const chat = document.querySelector('chat-assistant');
      if (chat) {
        if (!chat.isOpen) chat.toggleChat();
        const topicQuestions = {
          'voter-id': 'How do I get a Voter ID card (EPIC) in India?',
          'evm-vvpat': 'How does the EVM and VVPAT machine work?',
          'election-types': 'What are the different types of elections in India?',
          'model-code': 'What is the Model Code of Conduct and what are the rules?',
          'nota': 'What is NOTA and how does it work?',
          'counting': 'How are votes counted in Indian elections?'
        };
        const question = topicQuestions[topic];
        if (question) {
          const input = chat.querySelector('#chat-input');
          if (input) {
            input.value = question;
            chat.handleSend();
          }
        }
      }
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

/**
 * Sets up analytics tracking for resource links.
 */
function setupResourceTracking() {
  document.querySelectorAll('.resource-card').forEach(link => {
    link.addEventListener('click', () => {
      import('./utils/analytics.js').then(m => {
        m.trackResourceClicked(link.querySelector('.resource-card-url')?.textContent || '', 'resources');
      });
    });
  });
}

/**
 * Registers the service worker for PWA offline support.
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW] Registered:', reg.scope);
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  }
}

// ── Start the app ──
document.addEventListener('DOMContentLoaded', initApp);
