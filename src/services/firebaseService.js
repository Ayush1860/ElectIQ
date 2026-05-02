/**
 * @fileoverview Firebase service for ElectIQ.
 * Handles Authentication (Anonymous + Google), Firestore CRUD,
 * and Firebase Analytics initialization.
 * @module services/firebaseService
 */

/**
 * Firebase configuration — populated from environment or inline config.
 * In production, these values are safe to expose client-side
 * (they are restricted by domain in the Firebase Console).
 * @constant {Object}
 */
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

/** @type {firebase.app.App|null} */
let app = null;

/** @type {firebase.auth.Auth|null} */
let auth = null;

/** @type {firebase.firestore.Firestore|null} */
let db = null;

/** @type {firebase.analytics.Analytics|null} */
let analytics = null;

/** @type {firebase.User|null} */
let currentUser = null;

/** @type {Array<Function>} Auth state change listeners */
const authListeners = [];

/**
 * Initializes Firebase services: App, Auth, Firestore, Analytics.
 * Enables Firestore offline persistence.
 *
 * @returns {Promise<{auth: object, db: object, analytics: object}>}
 */
export async function initFirebase() {
  if (app) return { auth, db, analytics };

  try {
    app = firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    analytics = firebase.analytics();

    // Enable offline persistence
    await db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Persistence failed: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Persistence not available in this browser');
      }
    });

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      authListeners.forEach(fn => fn(user));
    });

    return { auth, db, analytics };
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    throw error;
  }
}

// ═══ Authentication ═══

/**
 * Signs in anonymously. Creates a temporary user session.
 *
 * @returns {Promise<firebase.User>} The anonymous user.
 */
export async function signInAnonymously() {
  if (!auth) throw new Error('Firebase not initialized');
  const result = await auth.signInAnonymously();
  return result.user;
}

/**
 * Signs in with Google using a popup.
 *
 * @returns {Promise<firebase.User>} The Google user.
 */
export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase not initialized');
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  const result = await auth.signInWithPopup(provider);
  return result.user;
}

/**
 * Signs out the current user.
 *
 * @returns {Promise<void>}
 */
export async function signOut() {
  if (!auth) return;
  await auth.signOut();
}

/**
 * Gets the current authenticated user.
 *
 * @returns {firebase.User|null} Current user or null.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Gets the current user's ID token for API authentication.
 *
 * @returns {Promise<string|null>} ID token or null if not authenticated.
 */
export async function getIdToken() {
  if (!currentUser) return null;
  return currentUser.getIdToken();
}

/**
 * Registers a callback for auth state changes.
 *
 * @param {Function} callback - Called with user object or null.
 * @returns {Function} Unsubscribe function.
 */
export function onAuthStateChanged(callback) {
  authListeners.push(callback);
  // Call immediately with current state
  if (currentUser !== undefined) {
    callback(currentUser);
  }
  return () => {
    const index = authListeners.indexOf(callback);
    if (index > -1) authListeners.splice(index, 1);
  };
}

// ═══ Firestore: User Progress ═══

/**
 * Saves user progress for a specific topic.
 *
 * @param {string} topicId - The topic identifier.
 * @param {Object} progressData - Progress data to save.
 * @param {number} progressData.score - Quiz score.
 * @param {string} progressData.progress - 'not_started' | 'in_progress' | 'completed'.
 * @returns {Promise<void>}
 */
export async function saveProgress(topicId, progressData) {
  if (!currentUser || !db) return;

  const docRef = db.collection('users').doc(currentUser.uid)
    .collection('progress').doc(topicId);

  await docRef.set({
    progress: progressData.progress,
    score: progressData.score || 0,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

/**
 * Gets user progress for all topics.
 *
 * @returns {Promise<Object>} Map of topicId → progress data.
 */
export async function getAllProgress() {
  if (!currentUser || !db) return {};

  const snapshot = await db.collection('users').doc(currentUser.uid)
    .collection('progress').get();

  const progress = {};
  snapshot.forEach(doc => {
    progress[doc.id] = doc.data();
  });
  return progress;
}

/**
 * Saves a chat session to Firestore.
 *
 * @param {string} sessionId - Unique session identifier.
 * @param {Array<Object>} messages - Chat messages array.
 * @returns {Promise<void>}
 */
export async function saveChatSession(sessionId, messages) {
  if (!currentUser || !db) return;

  await db.collection('users').doc(currentUser.uid)
    .collection('sessions').doc(sessionId).set({
      progress: JSON.stringify(messages.slice(-20)), // Keep last 20 messages
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      score: 0
    });
}

/**
 * Gets public election data from the shared collection.
 *
 * @param {string} jurisdiction - The jurisdiction key (e.g., 'india').
 * @returns {Promise<Object|null>} Election data or null.
 */
export async function getElectionData(jurisdiction) {
  if (!db) return null;

  const doc = await db.collection('public').doc('electionData')
    .collection(jurisdiction).get();

  if (doc.empty) return null;

  const data = {};
  doc.forEach(d => { data[d.id] = d.data(); });
  return data;
}

/**
 * Gets the Firebase Analytics instance.
 *
 * @returns {object|null} Firebase Analytics instance.
 */
export function getAnalytics() {
  return analytics;
}
