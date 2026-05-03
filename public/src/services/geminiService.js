/**
 * @fileoverview Gemini API client service for ElectIQ.
 * All requests go through Firebase Cloud Functions — NEVER directly to Gemini.
 * Implements streaming responses, retry with backoff, and client-side rate tracking.
 * @module services/geminiService
 */

import { sanitizeInput } from '../utils/sanitize.js';
import { getIdToken } from './firebaseService.js';

/**
 * Cloud Function endpoint for the Gemini API proxy.
 * @constant {string}
 */
const API_ENDPOINT = '/api/askElectIQ';

/**
 * Maximum requests per user per hour (client-side tracking as UX hint;
 * actual enforcement is server-side in Cloud Functions).
 * @constant {number}
 */
const MAX_REQUESTS_PER_HOUR = 20;

/** Client-side rate tracking state */
const rateState = {
  /** @type {number[]} Timestamps of recent requests */
  timestamps: [],
  /** @type {number} Remaining calls this hour */
  remaining: MAX_REQUESTS_PER_HOUR
};

/**
 * Sends a message to the ElectIQ Gemini proxy and returns a streaming response.
 *
 * @param {string} userMessage - The user's question (will be sanitized).
 * @param {Array<{role: string, content: string}>} [history=[]] - Conversation history.
 * @param {Object} [options={}] - Additional options.
 * @param {boolean} [options.jsonMode=false] - Request structured JSON output.
 * @param {AbortSignal} [options.signal] - AbortController signal for cancellation.
 * @returns {AsyncGenerator<string>} Yields text chunks as they stream in.
 * @throws {Error} If rate limited, network error, or server error.
 *
 * @example
 * for await (const chunk of sendMessage('How do I register to vote?')) {
 *   outputDiv.textContent += chunk;
 * }
 */
export async function* sendMessage(userMessage, history = [], options = {}) {
  // Sanitize input
  const cleanMessage = sanitizeInput(userMessage);
  if (!cleanMessage) {
    throw new Error('Please enter a valid message.');
  }

  // Client-side rate check (UX hint only; server enforces the real limit)
  if (!checkRateLimit()) {
    throw new RateLimitError('You have reached the maximum number of questions per hour. Please wait and try again.');
  }

  // Get auth token
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error('Please sign in to use the chat assistant.');
  }

  // Record request timestamp
  rateState.timestamps.push(Date.now());
  updateRemaining();

  // Build request body
  const body = {
    message: cleanMessage,
    history: history.slice(-10).map(m => ({
      role: m.role,
      content: sanitizeInput(m.content)
    })),
    jsonMode: options.jsonMode || false
  };

  try {
    const response = await fetchWithRetry(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(body),
      signal: options.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        throw new RateLimitError(errorData.error || 'Rate limit exceeded. Please wait.');
      }
      throw new Error(errorData.error || `Server error (${response.status})`);
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      // Parse SSE format
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              yield parsed.text;
            }
          } catch {
            // Non-JSON chunk, yield as plain text
            if (data.trim()) yield data;
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request was cancelled.');
    }
    throw error;
  }
}

/**
 * Sends a non-streaming message and returns the full response.
 * Used for structured/JSON responses (e.g., timeline data).
 *
 * @param {string} userMessage - The user's question.
 * @param {Object} [options={}] - Additional options.
 * @returns {Promise<Object>} Parsed JSON response.
 */
export async function sendMessageSync(userMessage, options = {}) {
  let fullResponse = '';
  for await (const chunk of sendMessage(userMessage, [], { ...options, jsonMode: true })) {
    fullResponse += chunk;
  }

  try {
    return JSON.parse(fullResponse);
  } catch {
    return { answer: fullResponse, keyPoints: [], officialLinks: [], followUpQuestion: '' };
  }
}

/**
 * Fetch with exponential backoff retry.
 *
 * @param {string} url - Request URL.
 * @param {RequestInit} init - Fetch options.
 * @param {number} [maxRetries=2] - Max retry attempts.
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, init, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      // Don't retry on client errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on 429 or 5xx
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') throw error;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Checks if the user is within the client-side rate limit.
 *
 * @returns {boolean} True if under the limit.
 */
function checkRateLimit() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  rateState.timestamps = rateState.timestamps.filter(t => t > oneHourAgo);
  return rateState.timestamps.length < MAX_REQUESTS_PER_HOUR;
}

/**
 * Updates the remaining requests counter.
 */
function updateRemaining() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  rateState.timestamps = rateState.timestamps.filter(t => t > oneHourAgo);
  rateState.remaining = Math.max(0, MAX_REQUESTS_PER_HOUR - rateState.timestamps.length);
}

/**
 * Gets the number of remaining API calls this hour (client-side estimate).
 *
 * @returns {number} Remaining calls.
 */
export function getRemainingCalls() {
  updateRemaining();
  return rateState.remaining;
}

/**
 * Custom error class for rate limit exceeded.
 */
export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}
