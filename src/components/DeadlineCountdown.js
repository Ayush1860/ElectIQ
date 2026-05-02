/**
 * @fileoverview Deadline Countdown Web Component for ElectIQ.
 * Real-time countdown to the next election milestone.
 * Respects prefers-reduced-motion.
 * @module components/DeadlineCountdown
 */

import { prefersReducedMotion } from '../utils/accessibility.js';

/**
 * Upcoming Indian election milestones.
 * In production, these dates would come from Firestore or an API.
 * @constant {Object[]}
 */
const MILESTONES = [
  {
    label: 'Next General Election',
    date: new Date('2029-05-01T07:00:00+05:30'),
    description: 'Lok Sabha Elections 2029'
  },
  {
    label: 'Voter List Revision Deadline',
    date: new Date('2027-01-15T23:59:59+05:30'),
    description: 'Last date to update electoral roll'
  }
];

/**
 * DeadlineCountdown Web Component.
 * @extends HTMLElement
 */
class DeadlineCountdown extends HTMLElement {
  constructor() {
    super();
    /** @type {number|null} */
    this.intervalId = null;
  }

  connectedCallback() {
    this.render();
    if (!prefersReducedMotion()) {
      this.startCountdown();
    }
  }

  disconnectedCallback() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  /** Gets the next upcoming milestone. */
  getNextMilestone() {
    const now = new Date();
    return MILESTONES.find(m => m.date > now) || MILESTONES[0];
  }

  /** Calculates time remaining. */
  getTimeRemaining(targetDate) {
    const total = targetDate - new Date();
    if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    return {
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((total / (1000 * 60)) % 60),
      seconds: Math.floor((total / 1000) % 60)
    };
  }

  /** Renders the countdown. */
  render() {
    const milestone = this.getNextMilestone();
    const time = this.getTimeRemaining(milestone.date);

    this.innerHTML = `
      <div class="countdown" role="timer" aria-label="Countdown to ${milestone.label}">
        <div>
          <div class="countdown-label">${milestone.label}</div>
          <div class="countdown-units">
            <div class="countdown-unit">
              <div class="countdown-value" id="cd-days">${time.days}</div>
              <div class="countdown-unit-label">Days</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-value" id="cd-hours">${time.hours}</div>
              <div class="countdown-unit-label">Hours</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-value" id="cd-mins">${time.minutes}</div>
              <div class="countdown-unit-label">Mins</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-value" id="cd-secs">${time.seconds}</div>
              <div class="countdown-unit-label">Secs</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /** Starts the countdown interval. */
  startCountdown() {
    this.intervalId = setInterval(() => {
      const milestone = this.getNextMilestone();
      const time = this.getTimeRemaining(milestone.date);

      const days = this.querySelector('#cd-days');
      const hours = this.querySelector('#cd-hours');
      const mins = this.querySelector('#cd-mins');
      const secs = this.querySelector('#cd-secs');

      if (days) days.textContent = time.days;
      if (hours) hours.textContent = time.hours;
      if (mins) mins.textContent = time.minutes;
      if (secs) secs.textContent = time.seconds;
    }, 1000);
  }
}

customElements.define('deadline-countdown', DeadlineCountdown);
export default DeadlineCountdown;
