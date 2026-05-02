/**
 * @fileoverview ElectIQ Cloud Functions — Backend API Proxy.
 *
 * Functions:
 *  1. askElectIQ — Gemini API proxy with rate limiting, sanitization, audit logging
 *  2. translateText — Cloud Translation API proxy
 *  3. findPollingPlaces — Google Places API proxy
 *
 * Security: All functions validate Firebase Auth tokens. API keys are never exposed client-side.
 *
 * @module functions/index
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Secrets (stored in Secret Manager, never in code)
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const TRANSLATE_API_KEY = defineSecret('TRANSLATE_API_KEY');
const MAPS_API_KEY = defineSecret('MAPS_API_KEY');

// DOMPurify setup for Node.js
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * ElectIQ system prompt for the Gemini model.
 * Enforces non-partisan, factual, plain-language responses about Indian elections.
 * @constant {string}
 */
const SYSTEM_PROMPT = `
You are ElectIQ, a nonpartisan election education assistant focused on INDIAN ELECTIONS,
built with Google AI. Your mission is to help people understand HOW elections work in India,
not WHO to vote for.

RULES:
1. Never endorse candidates, parties, or political positions
2. Present multiple perspectives on contested election policies
3. Cite only official sources: eci.gov.in, voters.eci.gov.in, sansad.in, state election websites
4. Use plain language (Grade 6-8 reading level / Flesch-Kincaid)
5. If asked about specific candidates: "I focus on the election process, not candidates.
   For candidate information, visit your state's Chief Electoral Officer website."
6. If asked about election integrity controversies: Present verified facts from
   official ECI sources only
7. Always end responses with 1 relevant follow-up question
8. Format responses with clear sections when explaining multi-step processes
9. If user seems confused, offer to explain with a simple analogy
10. Cover topics: voter registration, EPIC, EVM/VVPAT, NOTA, Model Code of Conduct,
    Lok Sabha, Rajya Sabha, Vidhan Sabha, Panchayat elections, counting process,
    FPTP system, ECI, BLO, NVSP portal, Form 6/7/8, delimitation

RESPONSE FORMAT (JSON when requested):
{
  "answer": "plain text explanation",
  "keyPoints": ["point1", "point2"],
  "officialLinks": [{"label": "ECI", "url": "https://eci.gov.in"}],
  "followUpQuestion": "Would you like to know about..."
}
`;

/**
 * Maximum API calls per user per hour.
 * @constant {number}
 */
const RATE_LIMIT = 20;

// ═══════════════════════════════════════════════════════════
// FUNCTION 1: askElectIQ — Gemini API Proxy
// ═══════════════════════════════════════════════════════════

exports.askElectIQ = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 10
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // ── 1. Authenticate ──
      const uid = await authenticateRequest(req);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
      }

      // ── 2. Rate Limit ──
      const withinLimit = await checkRateLimit(uid);
      if (!withinLimit) {
        auditLog('rate_limited', uid, { action: 'askElectIQ' });
        return res.status(429).json({
          error: 'Rate limit exceeded. Maximum 20 questions per hour.',
          retryAfter: 3600
        });
      }

      // ── 3. Validate & Sanitize Input ──
      const { message, history = [], jsonMode = false } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required.' });
      }

      const cleanMessage = DOMPurify.sanitize(message, { ALLOWED_TAGS: [] }).trim();
      if (cleanMessage.length === 0 || cleanMessage.length > 500) {
        return res.status(400).json({ error: 'Message must be 1-500 characters.' });
      }

      // ── 4. Build Gemini Request ──
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: SYSTEM_PROMPT
      });

      // Build chat history
      const chatHistory = (history || []).slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: DOMPurify.sanitize(m.content || '', { ALLOWED_TAGS: [] }) }]
      }));

      const chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {})
        }
      });

      // ── 5. Stream Response ──
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await chat.sendMessageStream(cleanMessage);

      let fullResponse = '';
      for await (const chunk of result.stream) {
        const text = chunk.text();
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();

      // ── 6. Audit Log ──
      auditLog('gemini_call', uid, {
        messageLength: cleanMessage.length,
        responseLength: fullResponse.length,
        jsonMode
      });

    } catch (error) {
      console.error('[askElectIQ] Error:', error);
      auditLog('error', 'system', { function: 'askElectIQ', error: error.message });
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// FUNCTION 2: translateText — Cloud Translation API Proxy
// ═══════════════════════════════════════════════════════════

exports.translateText = onRequest(
  {
    cors: true,
    secrets: [TRANSLATE_API_KEY],
    region: 'asia-south1',
    memory: '256MiB',
    timeoutSeconds: 30,
    maxInstances: 5
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const uid = await authenticateRequest(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const { text, texts, targetLang, sourceLang = 'en', batch = false } = req.body;

      if (!targetLang) {
        return res.status(400).json({ error: 'Target language is required.' });
      }

      const supportedLangs = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'es'];
      if (!supportedLangs.includes(targetLang)) {
        return res.status(400).json({ error: 'Unsupported language.' });
      }

      const apiKey = TRANSLATE_API_KEY.value();
      const baseUrl = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

      if (batch && Array.isArray(texts)) {
        // Batch translation
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: texts.slice(0, 50), // Max 50 texts per batch
            target: targetLang,
            source: sourceLang,
            format: 'text'
          })
        });

        const data = await response.json();
        const translations = data.data?.translations?.map(t => t.translatedText) || [];
        return res.json({ translations });
      } else {
        // Single translation
        if (!text) return res.status(400).json({ error: 'Text is required.' });

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text.substring(0, 5000),
            target: targetLang,
            source: sourceLang,
            format: 'text'
          })
        });

        const data = await response.json();
        const translatedText = data.data?.translations?.[0]?.translatedText || text;
        return res.json({ translatedText });
      }
    } catch (error) {
      console.error('[translateText] Error:', error);
      res.status(500).json({ error: 'Translation failed.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// FUNCTION 3: findPollingPlaces — Places API Proxy
// ═══════════════════════════════════════════════════════════

exports.findPollingPlaces = onRequest(
  {
    cors: true,
    secrets: [MAPS_API_KEY],
    region: 'asia-south1',
    memory: '256MiB',
    timeoutSeconds: 15,
    maxInstances: 5
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const uid = await authenticateRequest(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const { pincode, query } = req.body;
      const searchQuery = DOMPurify.sanitize(pincode || query || '', { ALLOWED_TAGS: [] }).trim();

      if (!searchQuery || searchQuery.length > 100) {
        return res.status(400).json({ error: 'Valid PIN code or area name required.' });
      }

      // Geocode the location
      const apiKey = MAPS_API_KEY.value();
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery + ', India')}&key=${apiKey}`;
      const geoResponse = await fetch(geocodeUrl);
      const geoData = await geoResponse.json();

      if (!geoData.results || geoData.results.length === 0) {
        return res.json({ places: [], message: 'Location not found' });
      }

      const location = geoData.results[0].geometry.location;

      // Search for nearby polling-related places
      const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=3000&keyword=polling+station+booth+voting&key=${apiKey}`;
      const placesResponse = await fetch(placesUrl);
      const placesData = await placesResponse.json();

      const places = (placesData.results || []).slice(0, 10).map(p => ({
        name: p.name,
        address: p.vicinity,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        rating: p.rating
      }));

      // Log without PII (only first 3 digits of pincode)
      auditLog('polling_search', uid, { pin_prefix: searchQuery.substring(0, 3) });

      return res.json({ places, center: location });
    } catch (error) {
      console.error('[findPollingPlaces] Error:', error);
      res.status(500).json({ error: 'Search failed.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Authenticates a request by verifying the Firebase ID token.
 *
 * @param {Object} req - Express request object.
 * @returns {Promise<string|null>} User UID or null if unauthorized.
 */
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Checks if a user is within the rate limit (20 calls/hour).
 * Uses Firestore to track request timestamps.
 *
 * @param {string} uid - User UID.
 * @returns {Promise<boolean>} True if within limit.
 */
async function checkRateLimit(uid) {
  const rateLimitRef = db.collection('rateLimits').doc(uid);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(rateLimitRef);
    const data = doc.data() || { timestamps: [] };

    // Filter to only timestamps within the last hour
    const recent = (data.timestamps || []).filter(t => t > oneHourAgo);

    if (recent.length >= RATE_LIMIT) {
      return false;
    }

    // Record new timestamp
    recent.push(Date.now());
    transaction.set(rateLimitRef, { timestamps: recent }, { merge: true });
    return true;
  });
}

/**
 * Writes an audit log entry to Cloud Logging.
 * No PII is logged.
 *
 * @param {string} action - Action name.
 * @param {string} uid - User UID (anonymized in logs).
 * @param {Object} [metadata={}] - Additional metadata.
 */
function auditLog(action, uid, metadata = {}) {
  const logEntry = {
    severity: 'INFO',
    message: `ElectIQ Audit: ${action}`,
    uid: uid ? uid.substring(0, 8) + '...' : 'anonymous',
    timestamp: new Date().toISOString(),
    ...metadata
  };

  // Structured logging for Cloud Logging
  console.log(JSON.stringify(logEntry));
}
