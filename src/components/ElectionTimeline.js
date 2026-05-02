/**
 * @fileoverview Interactive Election Timeline Web Component.
 * Renders the Indian election process as an expandable, phased timeline
 * with quiz integration, calendar buttons, and accessibility support.
 * @module components/ElectionTimeline
 */

import { announceToScreenReader, setupKeyboardNav } from '../utils/accessibility.js';
import { trackTopicViewed } from '../utils/analytics.js';
import { addToCalendar } from '../services/calendarService.js';

/**
 * Indian Election Process data — all phases and steps.
 * Content written at Flesch-Kincaid Grade 6-8 reading level.
 * @constant {Object[]}
 */
const ELECTION_PHASES = [
  {
    id: 'before',
    phase: 1,
    title: 'Before the Election',
    subtitle: '90–180 days before voting',
    cssClass: 'timeline-phase--before',
    steps: [
      {
        id: 'voter-registration',
        title: 'Step 1.1: Voter Registration',
        description: 'Every citizen aged 18 or above can register to vote. You need an EPIC (Voter ID card) to cast your vote. You can register online through the National Voters\' Service Portal (NVSP) at voters.eci.gov.in, or visit your local BLO (Booth Level Officer).',
        whyItMatters: 'If your name is not on the voter list, you cannot vote. Check your name early so there is time to fix any mistakes.',
        myth: 'Myth: "I registered once, so I don\'t need to check again."',
        fact: 'Fact: Names can be removed during list revision. Always check before each election at voters.eci.gov.in.',
        links: [
          { label: 'NVSP Portal', url: 'https://voters.eci.gov.in' },
          { label: 'ECI Official Site', url: 'https://eci.gov.in' }
        ],
        quiz: {
          question: 'What is the minimum age to register as a voter in India?',
          options: ['16 years', '18 years', '21 years', '25 years'],
          correctIndex: 1,
          explanation: 'Under Article 326 of the Indian Constitution, every citizen who is 18 years old or above can register as a voter.'
        },
        calendarEvent: 'registration_deadline'
      },
      {
        id: 'candidate-filing',
        title: 'Step 1.2: Candidate Nomination Filing',
        description: 'People who want to contest the election must file nomination papers with the Returning Officer. They must submit details about their income, assets, and any criminal cases. This information is made public so voters can make informed choices.',
        whyItMatters: 'Transparency in nominations helps voters know who is running and their background.',
        myth: 'Myth: "Anyone can contest elections without conditions."',
        fact: 'Fact: Candidates must meet eligibility criteria, pay a security deposit, and submit an affidavit with personal details.',
        links: [
          { label: 'ECI Candidate Info', url: 'https://eci.gov.in' }
        ],
        quiz: {
          question: 'What must candidates submit along with their nomination?',
          options: ['Only their name', 'An affidavit with asset and criminal case details', 'A party membership card', 'A college degree'],
          correctIndex: 1,
          explanation: 'Candidates must file an affidavit disclosing assets, liabilities, educational qualifications, and criminal cases (if any).'
        },
        calendarEvent: 'nomination_filing'
      },
      {
        id: 'scrutiny',
        title: 'Step 1.3: Scrutiny of Nominations',
        description: 'After nominations are filed, the Returning Officer checks if all papers are in order. If something is missing or the person is not eligible, their nomination can be rejected. Candidates can also choose to withdraw their nomination before a set deadline.',
        whyItMatters: 'This process ensures only eligible candidates appear on the ballot.',
        links: [
          { label: 'ECI Election Process', url: 'https://eci.gov.in/election-process' }
        ],
        quiz: {
          question: 'Who checks if a candidate\'s nomination is valid?',
          options: ['The Chief Minister', 'The Returning Officer', 'The Prime Minister', 'The voters'],
          correctIndex: 1,
          explanation: 'The Returning Officer appointed by the Election Commission scrutinizes all nomination papers.'
        }
      },
      {
        id: 'model-code',
        title: 'Step 1.4: Model Code of Conduct Begins',
        description: 'Once election dates are announced, the Model Code of Conduct (MCC) comes into effect. This is a set of rules all parties and candidates must follow. They cannot misuse government resources, make hate speeches, or bribe voters. The government cannot announce new policies to influence voters.',
        whyItMatters: 'The MCC ensures a level playing field so no party gets an unfair advantage.',
        myth: 'Myth: "The Model Code of Conduct is just a suggestion."',
        fact: 'Fact: The ECI actively enforces the MCC. Violations can lead to penalties, FIRs, and even disqualification.',
        links: [
          { label: 'Model Code of Conduct', url: 'https://eci.gov.in/mcc' }
        ],
        quiz: {
          question: 'When does the Model Code of Conduct come into effect?',
          options: ['On Election Day', 'When results are declared', 'When election dates are announced', 'One week before voting'],
          correctIndex: 2,
          explanation: 'The MCC is enforced from the moment the Election Commission announces the election schedule.'
        }
      }
    ]
  },
  {
    id: 'during',
    phase: 2,
    title: 'Election Period',
    subtitle: 'Campaigning, voting day(s)',
    cssClass: 'timeline-phase--during',
    steps: [
      {
        id: 'campaigning',
        title: 'Step 2.1: Campaigning Period',
        description: 'Political parties and candidates campaign to win votes. They hold rallies, go door-to-door, use media, and share their plans. Campaigning must stop 48 hours before polling begins — this is called the "silent period". No one can ask for votes during this time.',
        whyItMatters: 'The silent period gives voters time to think calmly about their choice without pressure.',
        links: [
          { label: 'ECI Guidelines', url: 'https://eci.gov.in' }
        ],
        quiz: {
          question: 'How many hours before polling must all campaigning stop?',
          options: ['12 hours', '24 hours', '48 hours', '72 hours'],
          correctIndex: 2,
          explanation: 'The Election Commission mandates a 48-hour silence period before polling begins.'
        },
        calendarEvent: 'campaign_end'
      },
      {
        id: 'polling-day',
        title: 'Step 2.2: Polling Day — Cast Your Vote',
        description: 'On polling day, voters go to their assigned polling booth. You must bring a valid photo ID (Voter ID card/EPIC is best, but Aadhaar, passport, driving licence are also accepted). Your finger will be marked with indelible ink, and you vote on the EVM (Electronic Voting Machine) by pressing the button next to your chosen candidate\'s name and symbol. A VVPAT slip confirms your choice.',
        whyItMatters: 'Your vote is your voice in democracy. Every single vote counts and is kept secret.',
        myth: 'Myth: "Someone can find out who I voted for."',
        fact: 'Fact: Voting is done in a private booth. The EVM does not record which voter pressed which button. Your vote is completely secret.',
        links: [
          { label: 'Voter Helpline', url: 'https://voters.eci.gov.in' },
          { label: 'ECI Voter Guide', url: 'https://eci.gov.in' }
        ],
        quiz: {
          question: 'Which machine is used for voting in Indian elections?',
          options: ['Paper ballot only', 'Computer', 'EVM (Electronic Voting Machine)', 'Mobile phone app'],
          correctIndex: 2,
          explanation: 'India uses EVMs (Electronic Voting Machines) along with VVPAT (Voter Verifiable Paper Audit Trail) for transparent voting.'
        },
        calendarEvent: 'polling_day'
      },
      {
        id: 'nota',
        title: 'Step 2.3: The NOTA Option',
        description: 'NOTA stands for "None of the Above". If you don\'t want to vote for any candidate, you can press the NOTA button on the EVM. This is your democratic right to reject all candidates. NOTA is the last option on every EVM.',
        whyItMatters: 'NOTA lets you participate in voting without supporting any candidate. It sends a message that voters want better choices.',
        myth: 'Myth: "NOTA votes are wasted."',
        fact: 'Fact: NOTA votes are counted and reported officially. They show voter dissatisfaction with all candidates.',
        links: [
          { label: 'NOTA Information', url: 'https://eci.gov.in' }
        ],
        quiz: {
          question: 'What does NOTA stand for?',
          options: ['Not On The Agenda', 'None of the Above', 'National Option To Abstain', 'No Opinion Taken Ahead'],
          correctIndex: 1,
          explanation: 'NOTA (None of the Above) allows voters to reject all candidates. It was introduced by the Supreme Court of India in 2013.'
        }
      }
    ]
  },
  {
    id: 'after',
    phase: 3,
    title: 'After the Election',
    subtitle: 'Counting, results, government formation',
    cssClass: 'timeline-phase--after',
    steps: [
      {
        id: 'counting',
        title: 'Step 3.1: Vote Counting Process',
        description: 'On counting day, EVMs are brought to counting centres under heavy security. Counting agents from each party watch the process. Votes are counted round by round, and trends are shown on results.eci.gov.in in real time. A random sample of VVPATs is matched with EVM counts to verify accuracy.',
        whyItMatters: 'Open counting with party agents ensures transparency and trust in the results.',
        links: [
          { label: 'Live Results', url: 'https://results.eci.gov.in' },
          { label: 'ECI Counting Process', url: 'https://eci.gov.in' }
        ],
        quiz: {
          question: 'Who watches the vote counting process?',
          options: ['Only ECI officials', 'Counting agents from each candidate/party', 'Only the winning party', 'No one — it is automated'],
          correctIndex: 1,
          explanation: 'Each candidate can appoint counting agents to observe the process at counting centres, ensuring transparency.'
        },
        calendarEvent: 'counting_day'
      },
      {
        id: 'results',
        title: 'Step 3.2: Results Declaration',
        description: 'The candidate who receives the most votes in a constituency wins that seat. The Returning Officer officially declares the result for each constituency. No minimum vote percentage is needed to win — the candidate with the most votes wins (First Past The Post system).',
        whyItMatters: 'Understanding the FPTP system helps you know why every vote matters, even in close contests.',
        links: [
          { label: 'Election Results', url: 'https://results.eci.gov.in' }
        ],
        quiz: {
          question: 'What system does India use to decide the winner?',
          options: ['Proportional Representation', 'First Past The Post', 'Ranked Choice Voting', 'Electoral College'],
          correctIndex: 1,
          explanation: 'India uses the First Past The Post (FPTP) system where the candidate with the most votes wins, regardless of vote percentage.'
        }
      },
      {
        id: 'recount',
        title: 'Step 3.3: Recounts & Election Petitions',
        description: 'If the margin of victory is very small or there are complaints of irregularities, a candidate can request a recount. After results are declared, an election petition can be filed in the High Court within 45 days to challenge the result. The court examines evidence of malpractice.',
        whyItMatters: 'The recount and petition system protects the fairness of elections even after results are out.',
        links: [
          { label: 'ECI Disputes', url: 'https://eci.gov.in' }
        ]
      },
      {
        id: 'government-formation',
        title: 'Step 3.4: Government Formation',
        description: 'The party or coalition that wins a majority of seats forms the government. For Lok Sabha, you need 272 out of 543 seats. The leader of the winning party is invited by the President to become Prime Minister. For state elections, the Governor invites the Chief Minister-designate.',
        whyItMatters: 'This final step turns your vote into the government that makes laws and policies affecting your daily life.',
        links: [
          { label: 'Parliament of India', url: 'https://sansad.in' },
          { label: 'ECI Official', url: 'https://eci.gov.in' }
        ],
        quiz: {
          question: 'How many Lok Sabha seats are needed to form a majority government?',
          options: ['200', '250', '272', '300'],
          correctIndex: 2,
          explanation: 'The Lok Sabha has 543 seats. A party or coalition needs 272 seats (simple majority) to form the government.'
        }
      }
    ]
  }
];

/**
 * ElectionTimeline Web Component.
 * Renders the full Indian election process as an interactive, expandable timeline.
 *
 * @extends HTMLElement
 */
class ElectionTimeline extends HTMLElement {
  constructor() {
    super();
    this.phases = ELECTION_PHASES;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    setupKeyboardNav(this, '.timeline-phase-header', (el) => el.click());
  }

  /**
   * Renders the complete timeline HTML.
   */
  render() {
    this.innerHTML = `
      <div class="timeline" role="region" aria-label="Indian Election Process Timeline">
        ${this.phases.map(phase => this.renderPhase(phase)).join('')}
      </div>
    `;
  }

  /**
   * Renders a single phase.
   * @param {Object} phase - Phase data.
   * @returns {string} HTML string.
   */
  renderPhase(phase) {
    return `
      <div class="timeline-phase ${phase.cssClass}" id="phase-${phase.id}" data-phase="${phase.phase}">
        <button class="timeline-phase-header"
                aria-expanded="false"
                aria-controls="phase-content-${phase.id}"
                id="phase-header-${phase.id}">
          <span class="timeline-phase-badge" aria-hidden="true">${phase.phase}</span>
          <div>
            <span class="timeline-phase-title">${phase.title}</span>
            <br><small style="color: var(--color-text-muted); font-family: var(--font-body); font-size: var(--fs-sm);">${phase.subtitle}</small>
          </div>
          <svg class="timeline-phase-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="timeline-phase-content" id="phase-content-${phase.id}" role="region" aria-labelledby="phase-header-${phase.id}">
          ${phase.steps.map(step => this.renderStep(step, phase.phase)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Renders a single step within a phase.
   * @param {Object} step - Step data.
   * @param {number} phaseNum - Phase number.
   * @returns {string} HTML string.
   */
  renderStep(step, phaseNum) {
    return `
      <article class="timeline-step" id="step-${step.id}" data-topic="${step.id}" tabindex="0" aria-label="${step.title}">
        <h3 class="timeline-step-title">${step.title}</h3>
        <p class="timeline-step-desc">${step.description}</p>

        ${step.whyItMatters ? `
          <div class="callout-box callout-box--why">
            <div class="callout-title">💡 Why This Matters</div>
            <p>${step.whyItMatters}</p>
          </div>
        ` : ''}

        ${step.myth ? `
          <div class="callout-box callout-box--myth">
            <div class="callout-title">❌ ${step.myth}</div>
          </div>
          <div class="callout-box callout-box--fact">
            <div class="callout-title">✅ ${step.fact}</div>
          </div>
        ` : ''}

        <div class="step-links">
          ${(step.links || []).map(link => `
            <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="step-link" data-resource="${link.label}" aria-label="Visit ${link.label} (opens in new tab)">
              🔗 ${link.label}
            </a>
          `).join('')}
          ${step.calendarEvent ? `
            <button class="step-link" data-calendar="${step.calendarEvent}" aria-label="Add ${step.title} deadline to calendar">
              📅 Add to Calendar
            </button>
          ` : ''}
        </div>

        ${step.quiz ? `
          <div class="step-quiz" data-quiz='${JSON.stringify(step.quiz)}' style="margin-top: var(--space-md); padding: var(--space-md); background: var(--color-primary-light); border-radius: var(--radius-md);">
            <p style="font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--color-primary); margin-bottom: var(--space-sm);">🧠 Quick Check</p>
            <p style="font-size: var(--fs-sm); margin-bottom: var(--space-sm);">${step.quiz.question}</p>
            <div class="step-quiz-options" style="display: flex; flex-direction: column; gap: var(--space-xs);">
              ${step.quiz.options.map((opt, i) => `
                <button class="quiz-option-inline btn btn-sm btn-outline" data-answer="${i}" data-correct="${step.quiz.correctIndex}" style="justify-content: flex-start;">
                  <span class="quiz-option-marker">${String.fromCharCode(65 + i)}</span>
                  ${opt}
                </button>
              `).join('')}
            </div>
            <p class="step-quiz-result" style="display: none; margin-top: var(--space-sm); font-size: var(--fs-sm);"></p>
          </div>
        ` : ''}
      </article>
    `;
  }

  /**
   * Sets up all event listeners for the timeline.
   */
  setupEventListeners() {
    // Phase toggle
    this.querySelectorAll('.timeline-phase-header').forEach(header => {
      header.addEventListener('click', () => this.togglePhase(header));
    });

    // Calendar buttons
    this.querySelectorAll('[data-calendar]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = btn.dataset.calendar;
        addToCalendar(eventId, new Date());
      });
    });

    // Resource link tracking
    this.querySelectorAll('[data-resource]').forEach(link => {
      link.addEventListener('click', () => {
        import('../utils/analytics.js').then(m => m.trackResourceClicked(link.dataset.resource, ''));
      });
    });

    // Inline quiz answers
    this.querySelectorAll('.quiz-option-inline').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleQuizAnswer(e));
    });

    // Topic view tracking
    this.querySelectorAll('.timeline-step').forEach(step => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const topic = step.dataset.topic;
            const phase = step.closest('.timeline-phase')?.dataset.phase;
            trackTopicViewed(topic, Number(phase));
            observer.unobserve(step);
          }
        });
      }, { threshold: 0.5 });
      observer.observe(step);
    });
  }

  /**
   * Toggles a phase open/closed.
   * @param {HTMLElement} header - The phase header button.
   */
  togglePhase(header) {
    const phase = header.closest('.timeline-phase');
    const isOpen = phase.hasAttribute('open');

    if (isOpen) {
      phase.removeAttribute('open');
      header.setAttribute('aria-expanded', 'false');
    } else {
      phase.setAttribute('open', '');
      header.setAttribute('aria-expanded', 'true');
      announceToScreenReader(`${header.querySelector('.timeline-phase-title').textContent} section expanded`);
    }
  }

  /**
   * Handles inline quiz answer selection.
   * @param {Event} e - Click event.
   */
  handleQuizAnswer(e) {
    const btn = e.currentTarget;
    const answer = parseInt(btn.dataset.answer);
    const correct = parseInt(btn.dataset.correct);
    const quizContainer = btn.closest('.step-quiz');
    const resultEl = quizContainer.querySelector('.step-quiz-result');
    const quizData = JSON.parse(quizContainer.dataset.quiz);

    // Disable all options
    quizContainer.querySelectorAll('.quiz-option-inline').forEach(opt => {
      opt.disabled = true;
    });

    if (answer === correct) {
      btn.classList.add('correct');
      btn.style.borderColor = 'var(--color-success)';
      btn.style.background = 'var(--color-success-light)';
      resultEl.textContent = `✅ Correct! ${quizData.explanation}`;
      resultEl.style.color = 'var(--color-success)';
      announceToScreenReader('Correct answer!');
    } else {
      btn.classList.add('incorrect');
      btn.style.borderColor = 'var(--color-danger)';
      btn.style.background = 'var(--color-danger-light)';
      // Highlight correct answer
      quizContainer.querySelectorAll('.quiz-option-inline')[correct].style.borderColor = 'var(--color-success)';
      quizContainer.querySelectorAll('.quiz-option-inline')[correct].style.background = 'var(--color-success-light)';
      resultEl.textContent = `❌ Not quite. ${quizData.explanation}`;
      resultEl.style.color = 'var(--color-danger)';
      announceToScreenReader('Incorrect. The correct answer has been highlighted.');
    }

    resultEl.style.display = 'block';
  }
}

customElements.define('election-timeline', ElectionTimeline);
export default ElectionTimeline;
