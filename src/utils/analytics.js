/**
 * @fileoverview Firebase Analytics wrapper for ElectIQ.
 * Tracks user engagement events without collecting PII.
 * All events follow the specification from requirements.
 * @module utils/analytics
 */

/** @type {object|null} Firebase Analytics instance */
let analyticsInstance = null;

/**
 * Initializes the analytics module with a Firebase Analytics instance.
 *
 * @param {object} analytics - Firebase Analytics instance.
 */
export function initAnalytics(analytics) {
  analyticsInstance = analytics;
}

/**
 * Logs a custom event to Firebase Analytics.
 * Strips any PII fields before logging.
 *
 * @param {string} eventName - The event name (snake_case).
 * @param {Object} [params={}] - Event parameters.
 */
function logEvent(eventName, params = {}) {
  // Strip potential PII
  const safeParams = stripPII(params);

  if (analyticsInstance && typeof firebase !== 'undefined') {
    firebase.analytics().logEvent(eventName, safeParams);
  }

  // Also log to console in development
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.debug(`[Analytics] ${eventName}`, safeParams);
  }
}

/**
 * Removes PII fields from event parameters.
 *
 * @param {Object} params - Raw parameters.
 * @returns {Object} Cleaned parameters.
 */
function stripPII(params) {
  const PII_FIELDS = ['name', 'email', 'phone', 'address', 'ip', 'full_zip'];
  const clean = { ...params };

  for (const field of PII_FIELDS) {
    delete clean[field];
  }

  // Truncate ZIP to first 3 digits only
  if (clean.zip) {
    clean.zip_prefix = String(clean.zip).substring(0, 3);
    delete clean.zip;
  }
  if (clean.pincode) {
    clean.pin_prefix = String(clean.pincode).substring(0, 3);
    delete clean.pincode;
  }

  return clean;
}

// ═══ Specific Event Trackers ═══

/**
 * Tracks when a user views an election topic.
 * @param {string} topic - Topic identifier.
 * @param {number} phase - Phase number (1-3).
 */
export function trackTopicViewed(topic, phase) {
  logEvent('election_topic_viewed', { topic, phase });
}

/**
 * Tracks when a user asks the AI assistant a question.
 * @param {'process'|'timeline'|'requirements'|'general'} category - Question category.
 */
export function trackQuestionAsked(category) {
  logEvent('ai_question_asked', { category });
}

/**
 * Tracks quiz completion.
 * @param {string} topic - Quiz topic.
 * @param {number} score - Score achieved (0-100).
 * @param {boolean} passed - Whether the user passed.
 */
export function trackQuizCompleted(topic, score, passed) {
  logEvent('quiz_completed', { topic, score, passed });
}

/**
 * Tracks polling locator usage.
 * @param {string} pincode - Full pincode (will be truncated to 3 digits).
 */
export function trackPollingLocatorUsed(pincode) {
  logEvent('polling_locator_used', { pincode }); // stripPII handles truncation
}

/**
 * Tracks language change.
 * @param {string} from - Previous language code.
 * @param {string} to - New language code.
 */
export function trackLanguageChanged(from, to) {
  logEvent('language_changed', { from, to });
}

/**
 * Tracks calendar event addition.
 * @param {string} eventType - Type of event added.
 */
export function trackCalendarEventAdded(eventType) {
  logEvent('calendar_event_added', { event_type: eventType });
}

/**
 * Tracks official resource link clicks.
 * @param {string} source - Source website.
 * @param {string} topic - Related topic.
 */
export function trackResourceClicked(source, topic) {
  logEvent('resource_link_clicked', { source, topic });
}

/**
 * Tracks AI response feedback (thumbs up/down).
 * @param {boolean} helpful - Whether the response was helpful.
 * @param {string} topic - Topic of the question.
 */
export function trackResponseFeedback(helpful, topic) {
  logEvent('ai_response_feedback', { helpful, topic });
}

/**
 * Tracks chart/data visualization interactions.
 * @param {string} chartType - Type of chart viewed.
 */
export function trackChartViewed(chartType) {
  logEvent('chart_viewed', { chart_type: chartType });
}
