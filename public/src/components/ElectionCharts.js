/**
 * @fileoverview Election Charts Web Component for ElectIQ.
 * Uses Google Charts to visualize voter turnout, state-wise data,
 * and election timelines.
 * @module components/ElectionCharts
 */

import { announceToScreenReader } from '../utils/accessibility.js';
import { trackChartViewed } from '../utils/analytics.js';

/**
 * Historical voter turnout data for Indian general elections.
 * Source: Election Commission of India.
 * @constant {Array<[string, number]>}
 */
const TURNOUT_DATA = [
  ['1952', 45.7], ['1957', 47.7], ['1962', 55.4], ['1967', 61.3],
  ['1971', 55.3], ['1977', 60.5], ['1980', 56.9], ['1984', 64.0],
  ['1989', 62.0], ['1991', 57.0], ['1996', 57.9], ['1998', 62.0],
  ['1999', 60.0], ['2004', 58.1], ['2009', 58.2], ['2014', 66.4],
  ['2019', 67.4], ['2024', 65.8]
];

/**
 * State-wise voter turnout (2024 Lok Sabha).
 * @constant {Array<[string, number]>}
 */
const STATE_DATA = [
  ['Lakshadweep', 84.1], ['Tripura', 81.8], ['Assam', 81.2],
  ['West Bengal', 79.1], ['Andhra Pradesh', 78.2], ['Kerala', 74.0],
  ['Tamil Nadu', 73.7], ['Karnataka', 70.0], ['Maharashtra', 65.0],
  ['Gujarat', 63.4], ['Rajasthan', 62.5], ['Uttar Pradesh', 60.5],
  ['Delhi', 58.7], ['Bihar', 56.0], ['Madhya Pradesh', 55.0]
];

/**
 * ElectionCharts Web Component.
 * @extends HTMLElement
 */
class ElectionCharts extends HTMLElement {
  constructor() {
    super();
    this.activeTab = 'turnout';
    this.chartsLoaded = false;
  }

  connectedCallback() {
    this.render();
    this.loadCharts();
  }

  /** Renders the component shell. */
  render() {
    this.innerHTML = `
      <div role="region" aria-label="Election data visualizations">
        <div class="charts-tabs" role="tablist" aria-label="Chart views">
          <button class="charts-tab ${this.activeTab === 'turnout' ? 'active' : ''}"
                  role="tab" id="tab-turnout"
                  aria-selected="${this.activeTab === 'turnout'}"
                  aria-controls="chart-turnout"
                  data-tab="turnout">
            📊 Voter Turnout Trend
          </button>
          <button class="charts-tab ${this.activeTab === 'state' ? 'active' : ''}"
                  role="tab" id="tab-state"
                  aria-selected="${this.activeTab === 'state'}"
                  aria-controls="chart-state"
                  data-tab="state">
            🗺️ State-wise Turnout
          </button>
          <button class="charts-tab ${this.activeTab === 'timeline' ? 'active' : ''}"
                  role="tab" id="tab-timeline"
                  aria-selected="${this.activeTab === 'timeline'}"
                  aria-controls="chart-timeline"
                  data-tab="timeline">
            📋 Election Timeline
          </button>
        </div>

        <div class="chart-container" id="chart-container" role="tabpanel"
             aria-labelledby="tab-${this.activeTab}">
          <div class="skeleton skeleton-card" style="height: 400px;" aria-label="Loading chart..."></div>
        </div>

        <!-- Accessible data table fallback -->
        <details style="margin-top: var(--space-md);">
          <summary style="font-size: var(--fs-sm); color: var(--color-text-muted); cursor: pointer;">
            📋 View data as table (accessible alternative)
          </summary>
          <div id="chart-data-table" style="margin-top: var(--space-sm); overflow-x: auto;"></div>
        </details>
      </div>
    `;

    this.setupTabListeners();
  }

  /** Sets up tab switching. */
  setupTabListeners() {
    this.querySelectorAll('.charts-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.querySelectorAll('.charts-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === this.activeTab);
          t.setAttribute('aria-selected', String(t.dataset.tab === this.activeTab));
        });
        this.drawActiveChart();
        trackChartViewed(this.activeTab);
      });
    });
  }

  /** Loads Google Charts and draws initial chart. */
  loadCharts() {
    if (typeof google === 'undefined' || !google.charts) {
      setTimeout(() => this.loadCharts(), 500);
      return;
    }

    google.charts.load('current', {
      packages: ['corechart', 'bar', 'table', 'timeline']
    });

    google.charts.setOnLoadCallback(() => {
      this.chartsLoaded = true;
      this.drawActiveChart();
    });
  }

  /** Draws the currently active chart. */
  drawActiveChart() {
    if (!this.chartsLoaded) return;

    const container = this.querySelector('#chart-container');
    container.innerHTML = '';
    container.style.minHeight = '400px';

    switch (this.activeTab) {
      case 'turnout': this.drawTurnoutChart(container); break;
      case 'state': this.drawStateChart(container); break;
      case 'timeline': this.drawTimelineChart(container); break;
    }

    announceToScreenReader(`Showing ${this.activeTab} chart`);
  }

  /**
   * Draws voter turnout trend line chart.
   * @param {HTMLElement} container
   */
  drawTurnoutChart(container) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Election Year');
    data.addColumn('number', 'Voter Turnout (%)');
    data.addRows(TURNOUT_DATA);

    const options = {
      title: 'Lok Sabha Voter Turnout: 1952 – 2024',
      titleTextStyle: { fontSize: 16, color: '#0F172A', fontName: 'DM Sans' },
      curveType: 'function',
      legend: { position: 'bottom' },
      hAxis: { title: 'Election Year', textStyle: { fontSize: 11 }, slantedText: true },
      vAxis: { title: 'Turnout (%)', minValue: 40, maxValue: 75 },
      colors: ['#1A56DB'],
      backgroundColor: 'transparent',
      chartArea: { left: 60, top: 50, right: 20, bottom: 80, width: '90%' },
      animation: { startup: true, duration: 1000, easing: 'out' },
      pointSize: 6,
      lineWidth: 3,
      tooltip: { textStyle: { fontSize: 13 } }
    };

    const chart = new google.visualization.LineChart(container);
    chart.draw(data, options);

    // Build accessible table
    this.buildAccessibleTable(
      ['Year', 'Turnout (%)'],
      TURNOUT_DATA.map(([year, pct]) => [year, pct.toFixed(1) + '%'])
    );
  }

  /**
   * Draws state-wise bar chart.
   * @param {HTMLElement} container
   */
  drawStateChart(container) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'State');
    data.addColumn('number', 'Voter Turnout (%)');
    data.addRows(STATE_DATA);

    const options = {
      title: 'State-wise Voter Turnout — 2024 Lok Sabha',
      titleTextStyle: { fontSize: 16, color: '#0F172A', fontName: 'DM Sans' },
      legend: { position: 'none' },
      hAxis: { title: 'Turnout (%)', minValue: 40 },
      vAxis: { textStyle: { fontSize: 11 } },
      colors: ['#1A56DB'],
      backgroundColor: 'transparent',
      chartArea: { left: 140, top: 50, right: 30, bottom: 40 },
      animation: { startup: true, duration: 800, easing: 'out' },
      bars: 'horizontal'
    };

    const chart = new google.visualization.BarChart(container);
    chart.draw(data, options);

    this.buildAccessibleTable(
      ['State', 'Turnout (%)'],
      STATE_DATA.map(([state, pct]) => [state, pct.toFixed(1) + '%'])
    );
  }

  /**
   * Draws election process timeline.
   * @param {HTMLElement} container
   */
  drawTimelineChart(container) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Phase');
    data.addColumn('string', 'Step');
    data.addColumn('date', 'Start');
    data.addColumn('date', 'End');

    // Example timeline for a typical Lok Sabha election
    const baseYear = 2029;
    data.addRows([
      ['Phase 1', 'Voter Registration', new Date(baseYear, 0, 1), new Date(baseYear, 1, 15)],
      ['Phase 1', 'Election Announcement', new Date(baseYear, 1, 15), new Date(baseYear, 1, 20)],
      ['Phase 1', 'Nomination Filing', new Date(baseYear, 1, 20), new Date(baseYear, 2, 5)],
      ['Phase 1', 'Scrutiny & Withdrawal', new Date(baseYear, 2, 5), new Date(baseYear, 2, 15)],
      ['Phase 2', 'Campaign Period', new Date(baseYear, 2, 15), new Date(baseYear, 3, 15)],
      ['Phase 2', 'Polling (Multiple Phases)', new Date(baseYear, 3, 15), new Date(baseYear, 4, 20)],
      ['Phase 3', 'Counting Day', new Date(baseYear, 4, 23), new Date(baseYear, 4, 24)],
      ['Phase 3', 'Government Formation', new Date(baseYear, 4, 25), new Date(baseYear, 5, 15)]
    ]);

    const options = {
      title: 'Typical Lok Sabha Election Timeline',
      backgroundColor: 'transparent',
      timeline: {
        showBarLabels: true,
        groupByRowLabel: true,
        colorByRowLabel: true
      },
      colors: ['#1A56DB', '#2563EB', '#3B82F6', '#60A5FA', '#F59E0B', '#FBBF24', '#059669', '#10B981']
    };

    const chart = new google.visualization.Timeline(container);
    chart.draw(data, options);

    this.buildAccessibleTable(
      ['Phase', 'Step', 'Start', 'End'],
      [
        ['Phase 1', 'Voter Registration', 'Jan', 'Feb'],
        ['Phase 1', 'Election Announcement', 'Feb', 'Feb'],
        ['Phase 1', 'Nomination Filing', 'Feb', 'Mar'],
        ['Phase 2', 'Campaign Period', 'Mar', 'Apr'],
        ['Phase 2', 'Polling', 'Apr', 'May'],
        ['Phase 3', 'Counting Day', 'May', 'May'],
        ['Phase 3', 'Government Formation', 'May', 'Jun']
      ]
    );
  }

  /**
   * Builds an accessible HTML table as fallback for screen readers.
   * @param {string[]} headers - Column headers.
   * @param {Array<string[]>} rows - Table rows.
   */
  buildAccessibleTable(headers, rows) {
    const tableContainer = this.querySelector('#chart-data-table');
    if (!tableContainer) return;

    tableContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: var(--fs-sm);"
             aria-label="Data table for ${this.activeTab} chart">
        <thead>
          <tr>${headers.map(h => `<th style="text-align: left; padding: var(--space-xs) var(--space-sm); border-bottom: 2px solid var(--color-border);">${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>${row.map(cell => `<td style="padding: var(--space-xs) var(--space-sm); border-bottom: 1px solid var(--color-border);">${cell}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

customElements.define('election-charts', ElectionCharts);
export default ElectionCharts;
