/**
 * @fileoverview ElectIQ Test Runner.
 * Validates components, services, security, and accessibility.
 * Run with: node tests/run.js
 * @module tests/run
 */

const fs = require('fs');
const path = require('path');

/** Test results accumulator */
const results = { passed: 0, failed: 0, errors: [] };

/**
 * Runs a test assertion.
 * @param {string} name - Test name.
 * @param {Function} fn - Test function returning boolean.
 */
function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      results.passed++;
      console.log(`  ✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`  ❌ ${name}`);
    }
  } catch (err) {
    results.failed++;
    results.errors.push(`${name}: ${err.message}`);
    console.log(`  ❌ ${name} — ${err.message}`);
  }
}

/**
 * Checks if a file exists.
 * @param {string} filePath - Relative path from project root.
 * @returns {boolean}
 */
function fileExists(filePath) {
  return fs.existsSync(path.join(__dirname, '..', filePath));
}

/**
 * Reads a file's content.
 * @param {string} filePath - Relative path from project root.
 * @returns {string}
 */
function readFile(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════

console.log('\n🧪 ElectIQ Test Suite\n');

// ── 1. File Structure Tests ──
console.log('📁 File Structure:');
test('index.html exists', () => fileExists('public/index.html'));
test('main.css exists', () => fileExists('public/styles/main.css'));
test('components.css exists', () => fileExists('public/styles/components.css'));
test('manifest.json exists', () => fileExists('public/manifest.json'));
test('sw.js exists', () => fileExists('public/sw.js'));
test('app.js exists', () => fileExists('src/app.js'));
test('firestore.rules exists', () => fileExists('firestore.rules'));
test('functions/index.js exists', () => fileExists('functions/index.js'));
test('All 8 components exist', () => {
  const components = [
    'ElectionTimeline', 'ChatAssistant', 'PollingLocator', 'QuizModule',
    'LanguageSwitcher', 'ProgressTracker', 'DeadlineCountdown', 'ElectionCharts'
  ];
  return components.every(c => fileExists(`src/components/${c}.js`));
});
test('All 4 services exist', () => {
  const services = ['firebaseService', 'geminiService', 'calendarService', 'translateService'];
  return services.every(s => fileExists(`src/services/${s}.js`));
});
test('All 3 utilities exist', () => {
  const utils = ['sanitize', 'accessibility', 'analytics'];
  return utils.every(u => fileExists(`src/utils/${u}.js`));
});

// ── 2. Security Tests ──
console.log('\n🔐 Security:');
test('CSP headers configured in firebase.json', () => {
  const config = readFile('firebase.json');
  return config.includes('Content-Security-Policy');
});
test('Firestore rules enforce auth', () => {
  const rules = readFile('firestore.rules');
  return rules.includes('request.auth != null') && rules.includes('request.auth.uid == userId');
});
test('Firestore rules validate fields', () => {
  const rules = readFile('firestore.rules');
  return rules.includes("hasOnly(['progress', 'timestamp', 'score'])");
});
test('Cloud Functions validate auth tokens', () => {
  const functions = readFile('functions/index.js');
  return functions.includes('verifyIdToken') && functions.includes('authenticateRequest');
});
test('Rate limiting implemented', () => {
  const functions = readFile('functions/index.js');
  return functions.includes('checkRateLimit') && functions.includes('RATE_LIMIT');
});
test('Server-side DOMPurify sanitization', () => {
  const functions = readFile('functions/index.js');
  return functions.includes('DOMPurify.sanitize');
});
test('Client-side DOMPurify imported', () => {
  const html = readFile('public/index.html');
  return html.includes('dompurify') || html.includes('DOMPurify');
});
test('API keys use Secret Manager', () => {
  const functions = readFile('functions/index.js');
  return functions.includes('defineSecret');
});
test('No API keys in client code', () => {
  const geminiService = readFile('src/services/geminiService.js');
  return !geminiService.includes('AIza') && !geminiService.includes('generativelanguage.googleapis.com');
});
test('Audit logging implemented', () => {
  const functions = readFile('functions/index.js');
  return functions.includes('auditLog');
});
test('PII stripping in analytics', () => {
  const analytics = readFile('src/utils/analytics.js');
  return analytics.includes('stripPII') && analytics.includes('pin_prefix');
});

// ── 3. Accessibility Tests ──
console.log('\n♿ Accessibility:');
test('Skip-to-content link present', () => {
  const html = readFile('public/index.html');
  return html.includes('skip-link') && html.includes('#main-content');
});
test('Screen reader announcer div exists', () => {
  const html = readFile('public/index.html');
  return html.includes('sr-announcer') && html.includes('aria-live="polite"');
});
test('ARIA landmarks on main sections', () => {
  const html = readFile('public/index.html');
  return html.includes('role="banner"') && html.includes('role="main"') && html.includes('role="contentinfo"');
});
test('HTML lang attribute set', () => {
  const html = readFile('public/index.html');
  return html.includes('<html lang="en"');
});
test('announceToScreenReader function exists', () => {
  const a11y = readFile('src/utils/accessibility.js');
  return a11y.includes('announceToScreenReader');
});
test('Focus trap utility exists', () => {
  const a11y = readFile('src/utils/accessibility.js');
  return a11y.includes('createFocusTrap');
});
test('prefers-reduced-motion respected', () => {
  const css = readFile('public/styles/main.css');
  return css.includes('prefers-reduced-motion');
});
test('Color contrast variables defined', () => {
  const css = readFile('public/styles/main.css');
  return css.includes('--color-primary: #1A56DB') && css.includes('--color-text: #0F172A');
});
test('Focus-visible styles defined', () => {
  const css = readFile('public/styles/main.css');
  return css.includes(':focus-visible');
});

// ── 4. Google Services Integration Tests ──
console.log('\n🔗 Google Services:');
test('Gemini API integration (via proxy)', () => {
  const functions = readFile('functions/index.js');
  return functions.includes('GoogleGenerativeAI') && functions.includes('gemini-2.0-flash');
});
test('Gemini system prompt includes Indian election context', () => {
  const functions = readFile('functions/index.js');
  return functions.includes('INDIAN ELECTIONS') && functions.includes('eci.gov.in');
});
test('Firebase Auth configured', () => {
  const service = readFile('src/services/firebaseService.js');
  return service.includes('signInAnonymously') && service.includes('signInWithPopup');
});
test('Firestore configured with persistence', () => {
  const service = readFile('src/services/firebaseService.js');
  return service.includes('enablePersistence');
});
test('Firebase Analytics configured', () => {
  const analytics = readFile('src/utils/analytics.js');
  return analytics.includes('logEvent') && analytics.includes('election_topic_viewed');
});
test('Google Maps integration (lazy loaded)', () => {
  const locator = readFile('src/components/PollingLocator.js');
  return locator.includes('maps.googleapis.com') && locator.includes('loadMapsAPI');
});
test('Google Charts integration', () => {
  const charts = readFile('src/components/ElectionCharts.js');
  return charts.includes('google.visualization') && charts.includes('LineChart');
});
test('Cloud Translation integration (via proxy)', () => {
  const translate = readFile('src/services/translateService.js');
  return translate.includes('SUPPORTED_LANGUAGES') && translate.includes('translateText');
});
test('Google Calendar integration', () => {
  const calendar = readFile('src/services/calendarService.js');
  return calendar.includes('calendar.google.com') && calendar.includes('generateICS');
});

// ── 5. Indian Election Content Tests ──
console.log('\n🇮🇳 Indian Election Content:');
test('ECI (Election Commission) referenced', () => {
  const timeline = readFile('src/components/ElectionTimeline.js');
  return timeline.includes('eci.gov.in') && timeline.includes('Election Commission');
});
test('EVM/VVPAT content included', () => {
  const timeline = readFile('src/components/ElectionTimeline.js');
  return timeline.includes('EVM') && timeline.includes('VVPAT');
});
test('NOTA explained', () => {
  const timeline = readFile('src/components/ElectionTimeline.js');
  return timeline.includes('NOTA') && timeline.includes('None of the Above');
});
test('Voter ID / EPIC content included', () => {
  const timeline = readFile('src/components/ElectionTimeline.js');
  return timeline.includes('EPIC') && timeline.includes('Voter ID');
});
test('NVSP portal referenced', () => {
  const timeline = readFile('src/components/ElectionTimeline.js');
  return timeline.includes('voters.eci.gov.in') || timeline.includes('NVSP');
});
test('Model Code of Conduct explained', () => {
  const timeline = readFile('src/components/ElectionTimeline.js');
  return timeline.includes('Model Code of Conduct');
});
test('Lok Sabha seats (543) mentioned', () => {
  const timeline = readFile('src/components/ElectionTimeline.js');
  return timeline.includes('543');
});
test('Indian languages supported (12+)', () => {
  const translate = readFile('src/services/translateService.js');
  return translate.includes("'hi'") && translate.includes("'ta'") && translate.includes("'te'");
});
test('Voter Helpline 1950 mentioned', () => {
  const locator = readFile('src/components/PollingLocator.js');
  return locator.includes('1950');
});

// ── 6. PWA Tests ──
console.log('\n📱 PWA:');
test('Service worker registered', () => {
  const app = readFile('src/app.js');
  return app.includes('serviceWorker.register');
});
test('PWA manifest linked', () => {
  const html = readFile('public/index.html');
  return html.includes('rel="manifest"');
});
test('Cache-first strategy implemented', () => {
  const sw = readFile('public/sw.js');
  return sw.includes('cacheFirst') && sw.includes('STATIC_CACHE');
});
test('Network-first strategy for APIs', () => {
  const sw = readFile('public/sw.js');
  return sw.includes('networkFirst') && sw.includes('NETWORK_FIRST_PATTERNS');
});

// ═══ Summary ═══
console.log('\n' + '═'.repeat(50));
console.log(`📊 Results: ${results.passed} passed, ${results.failed} failed`);
console.log('═'.repeat(50));

if (results.errors.length > 0) {
  console.log('\n❌ Failed tests:');
  results.errors.forEach(e => console.log(`   • ${e}`));
}

console.log('');
process.exit(results.failed > 0 ? 1 : 0);
