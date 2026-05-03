/**
 * @fileoverview Progress Tracker Web Component for ElectIQ.
 * Visual stepper showing learning progress across election phases.
 * @module components/ProgressTracker
 */

import { getAllProgress } from '../services/firebaseService.js';

/**
 * ProgressTracker Web Component.
 * @extends HTMLElement
 */
class ProgressTracker extends HTMLElement {
  constructor() {
    super();
    this.progress = { phase1: 0, phase2: 0, phase3: 0 };
  }

  async connectedCallback() {
    this.render();
    await this.loadProgress();
  }

  /** Loads user progress from Firestore. */
  async loadProgress() {
    try {
      const data = await getAllProgress();
      const topics = Object.values(data);
      const completed = topics.filter(t => t.progress === 'completed').length;
      const total = Math.max(topics.length, 10);
      const percentage = Math.round((completed / total) * 100);

      this.progress = {
        phase1: Math.min(100, percentage * 3),
        phase2: Math.min(100, Math.max(0, (percentage - 33) * 3)),
        phase3: Math.min(100, Math.max(0, (percentage - 66) * 3))
      };

      this.render();
    } catch {
      // Render default empty state
    }
  }

  /** Renders the progress tracker. */
  render() {
    const overall = Math.round(
      (this.progress.phase1 + this.progress.phase2 + this.progress.phase3) / 3
    );

    this.innerHTML = `
      <div class="progress-bar-container" role="group" aria-label="Learning progress">
        <div class="progress-phases">
          <div class="progress-phase" title="Before Election">
            <div class="progress-phase-fill" style="width: ${this.progress.phase1}%"
                 role="progressbar" aria-valuenow="${this.progress.phase1}"
                 aria-valuemin="0" aria-valuemax="100"
                 aria-label="Before Election: ${this.progress.phase1}% complete"></div>
          </div>
          <div class="progress-phase" title="Election Period">
            <div class="progress-phase-fill" style="width: ${this.progress.phase2}%; background: var(--color-accent);"
                 role="progressbar" aria-valuenow="${this.progress.phase2}"
                 aria-valuemin="0" aria-valuemax="100"
                 aria-label="Election Period: ${this.progress.phase2}% complete"></div>
          </div>
          <div class="progress-phase" title="After Election">
            <div class="progress-phase-fill" style="width: ${this.progress.phase3}%; background: var(--color-success);"
                 role="progressbar" aria-valuenow="${this.progress.phase3}"
                 aria-valuemin="0" aria-valuemax="100"
                 aria-label="After Election: ${this.progress.phase3}% complete"></div>
          </div>
        </div>
        <span class="progress-text">${overall}% learned</span>
      </div>
    `;
  }
}

customElements.define('progress-tracker', ProgressTracker);
export default ProgressTracker;
