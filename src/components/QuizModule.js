/**
 * @fileoverview Quiz Module Web Component for ElectIQ.
 * Flashcard-style quizzes with flip animation, score tracking,
 * and Firestore persistence.
 * @module components/QuizModule
 */

import { announceToScreenReader } from '../utils/accessibility.js';
import { trackQuizCompleted } from '../utils/analytics.js';
import { saveProgress } from '../services/firebaseService.js';

/**
 * Quiz questions about Indian elections.
 * @constant {Object[]}
 */
const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    topic: 'voter_registration',
    question: 'What is the minimum age to vote in Indian elections?',
    options: ['16 years', '18 years', '21 years', '25 years'],
    correctIndex: 1,
    explanation: 'As per Article 326 of the Constitution, every citizen who is 18 years or older on the qualifying date can register as a voter.'
  },
  {
    id: 'q2',
    topic: 'evm',
    question: 'What does VVPAT stand for?',
    options: ['Voter Verified Paper Audit Trail', 'Very Valid Paper Authentication Tool', 'Voting Verification and Paper Track', 'Voter Validated Paper Approval Test'],
    correctIndex: 0,
    explanation: 'VVPAT (Voter Verifiable Paper Audit Trail) prints a slip showing the symbol you voted for, confirming your vote was recorded correctly.'
  },
  {
    id: 'q3',
    topic: 'election_commission',
    question: 'Who conducts elections in India?',
    options: ['The Supreme Court', 'The President', 'The Election Commission of India', 'The Parliament'],
    correctIndex: 2,
    explanation: 'The Election Commission of India (ECI) is an autonomous constitutional body responsible for conducting free and fair elections.'
  },
  {
    id: 'q4',
    topic: 'lok_sabha',
    question: 'How many seats are there in the Lok Sabha?',
    options: ['245', '543', '500', '435'],
    correctIndex: 1,
    explanation: 'The Lok Sabha (House of the People) has 543 elected seats. A party or coalition needs 272 seats for a majority.'
  },
  {
    id: 'q5',
    topic: 'nota',
    question: 'When was the NOTA option introduced in Indian elections?',
    options: ['2004', '2009', '2013', '2019'],
    correctIndex: 2,
    explanation: 'The Supreme Court of India introduced NOTA in September 2013, giving voters the right to reject all candidates.'
  },
  {
    id: 'q6',
    topic: 'model_code',
    question: 'What happens when the Model Code of Conduct is in effect?',
    options: [
      'The government can announce new schemes freely',
      'Parties can use government vehicles for campaigning',
      'Government cannot announce new policies to influence voters',
      'There are no restrictions on campaigning'
    ],
    correctIndex: 2,
    explanation: 'During the MCC, the ruling government cannot announce new policies, schemes, or projects that could influence voters.'
  },
  {
    id: 'q7',
    topic: 'voter_id',
    question: 'What is the official name of the Voter ID card?',
    options: ['Aadhaar Card', 'PAN Card', 'EPIC (Electors Photo Identity Card)', 'Ration Card'],
    correctIndex: 2,
    explanation: 'The Voter ID card is officially called EPIC — Electors Photo Identity Card. It is issued by the Election Commission.'
  },
  {
    id: 'q8',
    topic: 'counting',
    question: 'What voting system does India use to decide the winner?',
    options: ['Proportional Representation', 'Ranked Choice Voting', 'First Past The Post', 'Electoral College'],
    correctIndex: 2,
    explanation: 'India uses the First Past The Post (FPTP) system. The candidate with the most votes in a constituency wins, regardless of percentage.'
  },
  {
    id: 'q9',
    topic: 'registration',
    question: 'Which portal is used for online voter registration in India?',
    options: ['india.gov.in', 'voters.eci.gov.in (NVSP)', 'aadhar.uidai.gov.in', 'passport.gov.in'],
    correctIndex: 1,
    explanation: 'The National Voters\' Service Portal (NVSP) at voters.eci.gov.in allows citizens to register, check status, and update voter details online.'
  },
  {
    id: 'q10',
    topic: 'helpline',
    question: 'What is the Voter Helpline number in India?',
    options: ['100', '112', '1950', '1800'],
    correctIndex: 2,
    explanation: 'The Voter Helpline 1950 provides information about voter registration, polling booths, and election-related queries.'
  }
];

/**
 * QuizModule Web Component.
 * Interactive flashcard-style quiz with score tracking.
 *
 * @extends HTMLElement
 */
class QuizModule extends HTMLElement {
  constructor() {
    super();
    this.questions = [...QUIZ_QUESTIONS];
    this.currentIndex = 0;
    this.score = 0;
    this.answered = false;
    this.answers = [];
  }

  connectedCallback() {
    this.render();
  }

  /** Renders the quiz UI. */
  render() {
    if (this.currentIndex >= this.questions.length) {
      this.renderScore();
      return;
    }

    const q = this.questions[this.currentIndex];
    const progress = ((this.currentIndex) / this.questions.length) * 100;

    this.innerHTML = `
      <div class="quiz-container" role="region" aria-label="Election Knowledge Quiz">
        <div class="quiz-progress">
          <div class="quiz-progress-bar" role="progressbar"
               aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"
               aria-label="Quiz progress: ${this.currentIndex} of ${this.questions.length}">
            <div class="quiz-progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="quiz-progress-text">${this.currentIndex + 1} / ${this.questions.length}</span>
        </div>

        <div class="quiz-card ${this.answered ? 'flipped' : ''}" id="quiz-card">
          <div class="quiz-card-inner">
            <!-- Front: Question -->
            <div class="quiz-card-front">
              <span class="quiz-question-label">Question ${this.currentIndex + 1}</span>
              <p class="quiz-question-text">${q.question}</p>
              <div class="quiz-options" role="radiogroup" aria-label="Answer options">
                ${q.options.map((opt, i) => `
                  <button class="quiz-option" data-index="${i}" role="radio"
                          aria-checked="false" aria-label="Option ${String.fromCharCode(65 + i)}: ${opt}"
                          ${this.answered ? 'disabled' : ''}>
                    <span class="quiz-option-marker">${String.fromCharCode(65 + i)}</span>
                    <span>${opt}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Back: Explanation -->
            <div class="quiz-card-back">
              <div class="quiz-explanation">
                <div class="quiz-explanation-icon" aria-hidden="true" id="quiz-result-icon">
                  ${this.answered ? (this.lastCorrect ? '✅' : '❌') : ''}
                </div>
                <h3 id="quiz-result-title">${this.answered ? (this.lastCorrect ? 'Correct!' : 'Not Quite') : ''}</h3>
                <p class="quiz-explanation-text" id="quiz-explanation-text">${q.explanation}</p>
                <div class="quiz-nav">
                  ${this.currentIndex < this.questions.length - 1 ? `
                    <button class="btn btn-primary" id="quiz-next" aria-label="Next question">
                      Next Question →
                    </button>
                  ` : `
                    <button class="btn btn-primary" id="quiz-finish" aria-label="See your score">
                      See Your Score 🎉
                    </button>
                  `}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupQuizListeners();
  }

  /** Sets up quiz event listeners. */
  setupQuizListeners() {
    // Answer selection
    this.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => this.handleAnswer(parseInt(btn.dataset.index)));
    });

    // Next question
    const nextBtn = this.querySelector('#quiz-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentIndex++;
        this.answered = false;
        this.render();
      });
    }

    // Finish quiz
    const finishBtn = this.querySelector('#quiz-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        this.currentIndex++;
        this.renderScore();
      });
    }

    // Keyboard support
    this.addEventListener('keydown', (e) => {
      if (this.answered) return;
      const keyMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
      const index = keyMap[e.key.toLowerCase()];
      if (index !== undefined && index < this.questions[this.currentIndex].options.length) {
        this.handleAnswer(index);
      }
    });
  }

  /**
   * Handles answer selection.
   * @param {number} selectedIndex - Index of selected answer.
   */
  handleAnswer(selectedIndex) {
    if (this.answered) return;
    this.answered = true;

    const q = this.questions[this.currentIndex];
    const isCorrect = selectedIndex === q.correctIndex;
    this.lastCorrect = isCorrect;

    if (isCorrect) this.score++;
    this.answers.push({ questionId: q.id, selected: selectedIndex, correct: isCorrect });

    // Update option styling
    this.querySelectorAll('.quiz-option').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correctIndex) btn.classList.add('correct');
      if (i === selectedIndex && !isCorrect) btn.classList.add('incorrect');
      btn.setAttribute('aria-checked', String(i === selectedIndex));
    });

    // Flip card after brief delay
    setTimeout(() => {
      const card = this.querySelector('#quiz-card');
      if (card) card.classList.add('flipped');

      const icon = this.querySelector('#quiz-result-icon');
      const title = this.querySelector('#quiz-result-title');
      if (icon) icon.textContent = isCorrect ? '✅' : '❌';
      if (title) title.textContent = isCorrect ? 'Correct!' : 'Not Quite';

      announceToScreenReader(
        isCorrect
          ? `Correct! ${q.explanation}`
          : `Incorrect. The correct answer was ${q.options[q.correctIndex]}. ${q.explanation}`
      );
    }, 500);
  }

  /** Renders the final score screen. */
  renderScore() {
    const percentage = Math.round((this.score / this.questions.length) * 100);
    const passed = percentage >= 60;

    this.innerHTML = `
      <div class="quiz-container" role="region" aria-label="Quiz results">
        <div class="quiz-score">
          <div class="quiz-explanation-icon" aria-hidden="true" style="font-size: 4rem;">
            ${passed ? '🎉' : '📚'}
          </div>
          <h3 style="font-size: var(--fs-2xl); margin: var(--space-md) 0;">
            ${passed ? 'Great Job!' : 'Keep Learning!'}
          </h3>
          <div class="quiz-score-value" aria-label="Score: ${this.score} out of ${this.questions.length}">
            ${this.score}/${this.questions.length}
          </div>
          <p style="color: var(--color-text-secondary); margin: var(--space-md) 0;">
            You scored ${percentage}% — ${passed ? 'you know your election basics well!' : 'review the timeline to learn more.'}
          </p>
          <div class="quiz-nav" style="margin-top: var(--space-xl);">
            <button class="btn btn-primary" id="quiz-retry" aria-label="Take the quiz again">
              Try Again 🔄
            </button>
            <a href="#timeline" class="btn btn-outline" aria-label="Review the election timeline">
              Review Timeline 📋
            </a>
          </div>
        </div>
      </div>
    `;

    // Track completion
    trackQuizCompleted('indian_elections', percentage, passed);

    // Save to Firestore
    saveProgress('quiz_general', {
      progress: passed ? 'completed' : 'in_progress',
      score: percentage
    });

    // Retry button
    this.querySelector('#quiz-retry')?.addEventListener('click', () => {
      this.currentIndex = 0;
      this.score = 0;
      this.answered = false;
      this.answers = [];
      this.render();
    });

    announceToScreenReader(`Quiz complete. You scored ${this.score} out of ${this.questions.length}. ${percentage} percent.`);
  }
}

customElements.define('quiz-module', QuizModule);
export default QuizModule;
