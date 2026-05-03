/**
 * @fileoverview Google Calendar & ICS service for ElectIQ.
 * Generates Google Calendar links and .ics file downloads for election deadlines.
 * @module services/calendarService
 */

import { trackCalendarEventAdded } from '../utils/analytics.js';

/**
 * Indian election event templates.
 * Dates are examples — real dates come from ECI announcements.
 * @constant {Object[]}
 */
export const ELECTION_EVENTS = [
  {
    id: 'registration_deadline',
    title: 'Voter Registration Deadline',
    description: 'Last date to register as a voter or update your details on the NVSP portal (voters.eci.gov.in). Ensure your name is on the electoral roll.',
    location: 'Online: voters.eci.gov.in',
    durationHours: 24,
    category: 'registration'
  },
  {
    id: 'nomination_filing',
    title: 'Candidate Nomination Filing Deadline',
    description: 'Last date for candidates to file nomination papers with the Returning Officer.',
    location: 'Returning Officer, District',
    durationHours: 8,
    category: 'nomination'
  },
  {
    id: 'campaign_end',
    title: 'Campaign Period Ends (Silent Period)',
    description: 'All campaigning must stop 48 hours before polling. No canvassing, speeches, or processions allowed.',
    location: 'Constituency',
    durationHours: 48,
    category: 'campaign'
  },
  {
    id: 'polling_day',
    title: 'Election Day — Cast Your Vote',
    description: 'Polling booths open 7 AM to 6 PM. Carry your Voter ID (EPIC) or any approved photo ID. Every vote counts!',
    location: 'Your assigned polling booth',
    durationHours: 11,
    category: 'voting'
  },
  {
    id: 'counting_day',
    title: 'Vote Counting Day',
    description: 'EVM counting begins at designated counting centres. Results typically declared same day. Follow results.eci.gov.in.',
    location: 'Counting Centre, District',
    durationHours: 12,
    category: 'counting'
  }
];

/**
 * Generates a Google Calendar event URL.
 *
 * @param {Object} event - Event details.
 * @param {string} event.title - Event title.
 * @param {string} event.description - Event description.
 * @param {string} event.location - Event location.
 * @param {Date} event.startDate - Start date/time.
 * @param {Date} event.endDate - End date/time.
 * @returns {string} Google Calendar URL.
 */
export function generateGoogleCalendarUrl(event) {
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDate(event.startDate)}/${formatDate(event.endDate)}`,
    details: event.description,
    location: event.location,
    sf: 'true'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an .ics file content string for calendar import.
 *
 * @param {Object} event - Event details.
 * @param {string} event.title - Event title.
 * @param {string} event.description - Event description.
 * @param {string} event.location - Event location.
 * @param {Date} event.startDate - Start date/time.
 * @param {Date} event.endDate - End date/time.
 * @returns {string} ICS file content.
 */
export function generateICS(event) {
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const uid = `electiq-${event.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ElectIQ//Election Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@electiq.app`,
    `DTSTART:${formatDate(event.startDate)}`,
    `DTEND:${formatDate(event.endDate)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    'STATUS:CONFIRMED',
    `CREATED:${formatDate(new Date())}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Election event tomorrow',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Downloads an .ics file to the user's device.
 *
 * @param {Object} event - Event details.
 * @param {string} event.title - Event title.
 * @param {string} event.description - Event description.
 * @param {string} event.location - Event location.
 * @param {Date} event.startDate - Start date/time.
 * @param {Date} event.endDate - End date/time.
 */
export function downloadICS(event) {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `electiq-${event.title.toLowerCase().replace(/\s+/g, '-')}.ics`;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Opens a Google Calendar link or downloads ICS as fallback.
 * Tracks the action via analytics.
 *
 * @param {string} eventId - ID from ELECTION_EVENTS.
 * @param {Date} startDate - Event start date.
 */
export function addToCalendar(eventId, startDate) {
  const template = ELECTION_EVENTS.find(e => e.id === eventId);
  if (!template) return;

  const endDate = new Date(startDate.getTime() + template.durationHours * 60 * 60 * 1000);

  const event = {
    title: template.title,
    description: template.description,
    location: template.location,
    startDate,
    endDate
  };

  // Try Google Calendar first
  const calUrl = generateGoogleCalendarUrl(event);
  const win = window.open(calUrl, '_blank', 'noopener,noreferrer');

  // Fallback to ICS if popup blocked
  if (!win) {
    downloadICS(event);
  }

  // Track analytics
  trackCalendarEventAdded(eventId);
}
