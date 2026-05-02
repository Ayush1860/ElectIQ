/**
 * @fileoverview Polling Station Locator Web Component for ElectIQ.
 * Uses Google Maps JavaScript API with Places library to help users
 * find their nearest polling booth by entering their location/PIN code.
 * @module components/PollingLocator
 */

import { announceToScreenReader } from '../utils/accessibility.js';
import { sanitizeInput } from '../utils/sanitize.js';
import { trackPollingLocatorUsed } from '../utils/analytics.js';

/** @type {boolean} Whether the Maps API has been loaded */
let mapsLoaded = false;

/** @type {google.maps.Map|null} */
let mapInstance = null;

/** @type {google.maps.marker.AdvancedMarkerElement[]} */
let markers = [];

/**
 * PollingLocator Web Component.
 * Provides a search interface + Google Map to find polling stations.
 *
 * @extends HTMLElement
 */
class PollingLocator extends HTMLElement {
  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  /** Renders the component HTML. */
  render() {
    this.innerHTML = `
      <div class="polling-container" role="region" aria-label="Polling booth finder">
        <div class="polling-search">
          <div class="polling-input-group">
            <label for="polling-pincode" class="polling-label">Enter your PIN code or area name</label>
            <input
              type="text"
              id="polling-pincode"
              class="polling-input"
              placeholder="e.g., 110001 or Connaught Place"
              aria-describedby="polling-help"
              maxlength="100"
              autocomplete="postal-code"
            >
            <small id="polling-help" style="color: var(--color-text-muted); font-size: var(--fs-xs);">
              Enter a 6-digit PIN code or area name to find nearby polling stations
            </small>
          </div>
          <button class="btn btn-primary" id="polling-search-btn" aria-label="Search for polling stations">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M8 3a5 5 0 104.906 5.988l3.553 3.553a1 1 0 01-1.414 1.414l-3.553-3.553A5 5 0 008 3zm0 2a3 3 0 100 6 3 3 0 000-6z" fill="currentColor"/></svg>
            Find Polling Booths
          </button>

          <div id="polling-status" class="sr-only" aria-live="polite"></div>

          <div id="polling-results" class="polling-results" role="list" aria-label="Polling station results">
            <div class="empty-state" id="polling-empty">
              <div class="empty-state-icon" aria-hidden="true">📍</div>
              <p>Enter your PIN code to find nearby polling booths</p>
              <p style="font-size: var(--fs-xs); color: var(--color-text-muted); margin-top: var(--space-sm);">
                You can also check your polling booth at
                <a href="https://voters.eci.gov.in" target="_blank" rel="noopener noreferrer">voters.eci.gov.in</a>
              </p>
            </div>
          </div>
        </div>

        <div class="polling-map" id="polling-map-container" role="application" aria-label="Map showing polling station locations">
          <div class="polling-map-placeholder" id="polling-map-placeholder">
            <div class="empty-state-icon" aria-hidden="true">🗺️</div>
            <p>Map will appear after you search</p>
            <p style="font-size: var(--fs-xs); color: var(--color-text-muted); margin-top: var(--space-sm);">
              Powered by Google Maps
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /** Sets up event listeners. */
  setupEventListeners() {
    const searchBtn = this.querySelector('#polling-search-btn');
    const input = this.querySelector('#polling-pincode');

    searchBtn.addEventListener('click', () => this.handleSearch());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });
  }

  /** Handles the search action. */
  async handleSearch() {
    const input = this.querySelector('#polling-pincode');
    const rawQuery = input.value.trim();
    const query = sanitizeInput(rawQuery);

    if (!query) {
      announceToScreenReader('Please enter a PIN code or area name');
      input.focus();
      return;
    }

    // Track search (PIN prefix only for privacy)
    trackPollingLocatorUsed(query);

    const searchBtn = this.querySelector('#polling-search-btn');
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="skeleton" style="width:100px;height:16px;display:inline-block;"></span> Searching...';

    try {
      // Lazy load Maps API
      if (!mapsLoaded) {
        await this.loadMapsAPI();
      }

      await this.searchPollingStations(query);
    } catch (error) {
      console.error('[PollingLocator] Search failed:', error);
      this.showSearchError();
    } finally {
      searchBtn.disabled = false;
      searchBtn.innerHTML = `
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M8 3a5 5 0 104.906 5.988l3.553 3.553a1 1 0 01-1.414 1.414l-3.553-3.553A5 5 0 008 3zm0 2a3 3 0 100 6 3 3 0 000-6z" fill="currentColor"/></svg>
        Find Polling Booths
      `;
    }
  }

  /**
   * Lazy loads the Google Maps JavaScript API.
   * @returns {Promise<void>}
   */
  async loadMapsAPI() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        mapsLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      // In production, the API key would be configured; using placeholder for demo
      script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY'}&libraries=places,marker&callback=__initMap`;
      script.async = true;
      script.defer = true;

      window.__initMap = () => {
        mapsLoaded = true;
        delete window.__initMap;
        resolve();
      };

      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }

  /**
   * Searches for polling stations near the given query.
   * @param {string} query - PIN code or area name.
   */
  async searchPollingStations(query) {
    const mapContainer = this.querySelector('#polling-map-container');
    const placeholder = this.querySelector('#polling-map-placeholder');

    // Initialize map if needed
    if (!mapInstance) {
      if (placeholder) placeholder.style.display = 'none';

      mapInstance = new google.maps.Map(mapContainer, {
        center: { lat: 20.5937, lng: 78.9629 }, // Center of India
        zoom: 12,
        mapId: 'electiq-polling-map',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true
      });
    }

    // Clear existing markers
    markers.forEach(m => m.map = null);
    markers = [];

    // Use Geocoder to find the location
    const geocoder = new google.maps.Geocoder();

    const geocodeResult = await new Promise((resolve, reject) => {
      geocoder.geocode(
        { address: `${query}, India` },
        (results, status) => {
          if (status === 'OK' && results.length > 0) resolve(results[0]);
          else reject(new Error('Location not found'));
        }
      );
    });

    const location = geocodeResult.geometry.location;
    mapInstance.setCenter(location);
    mapInstance.setZoom(14);

    // Search for polling stations nearby using Places API
    const placesService = new google.maps.places.PlacesService(mapInstance);

    const results = await new Promise((resolve) => {
      placesService.nearbySearch(
        {
          location,
          radius: 3000,
          keyword: 'polling station booth voting centre',
          type: 'point_of_interest'
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(results);
          } else {
            // If no polling stations found, show the area with government buildings
            placesService.nearbySearch(
              {
                location,
                radius: 5000,
                keyword: 'school government office community hall',
                type: 'school'
              },
              (fallbackResults, fallbackStatus) => {
                resolve(fallbackStatus === google.maps.places.PlacesServiceStatus.OK ? fallbackResults : []);
              }
            );
          }
        }
      );
    });

    // Display results
    this.displayResults(results.slice(0, 8), location);

    // Announce to screen reader
    announceToScreenReader(
      results.length > 0
        ? `Found ${results.length} possible polling locations near ${query}`
        : 'No polling stations found. Please check voters.eci.gov.in for exact booth details.'
    );
  }

  /**
   * Displays search results on map and in list.
   * @param {Object[]} places - Google Places results.
   * @param {google.maps.LatLng} center - Search center location.
   */
  displayResults(places, center) {
    const resultsEl = this.querySelector('#polling-results');

    if (places.length === 0) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">🔍</div>
          <p>No polling stations found in this area</p>
          <p style="font-size: var(--fs-xs); color: var(--color-text-muted); margin-top: var(--space-sm);">
            For your exact polling booth, visit
            <a href="https://voters.eci.gov.in" target="_blank" rel="noopener noreferrer">voters.eci.gov.in</a>
            or call Voter Helpline <strong>1950</strong>.
          </p>
        </div>
      `;
      return;
    }

    // Add main location marker
    new google.maps.marker.AdvancedMarkerElement({
      map: mapInstance,
      position: center,
      title: 'Your search location'
    });

    // Build results list and markers
    resultsEl.innerHTML = places.map((place, i) => `
      <div class="polling-result-card" role="listitem" tabindex="0"
           data-lat="${place.geometry.location.lat()}"
           data-lng="${place.geometry.location.lng()}"
           aria-label="${place.name}, ${place.vicinity || ''}">
        <div class="polling-result-name">📍 ${place.name}</div>
        <div class="polling-result-addr">${place.vicinity || 'Address not available'}</div>
      </div>
    `).join('');

    // Add markers for each place
    places.forEach((place, i) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: place.geometry.location,
        title: place.name
      });
      markers.push(marker);
    });

    // Click result to focus on map
    resultsEl.querySelectorAll('.polling-result-card').forEach(card => {
      card.addEventListener('click', () => {
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        mapInstance.panTo({ lat, lng });
        mapInstance.setZoom(16);
        announceToScreenReader(`Showing ${card.querySelector('.polling-result-name').textContent} on map`);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });

    // Fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(center);
    places.forEach(p => bounds.extend(p.geometry.location));
    mapInstance.fitBounds(bounds);
  }

  /** Shows search error state. */
  showSearchError() {
    const resultsEl = this.querySelector('#polling-results');
    resultsEl.innerHTML = `
      <div class="error-state">
        <p>⚠️ Could not search this location. Please try a different PIN code.</p>
        <p style="font-size: var(--fs-xs); margin-top: var(--space-sm);">
          Or visit <a href="https://voters.eci.gov.in" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">voters.eci.gov.in</a>
        </p>
      </div>
    `;
    announceToScreenReader('Search failed. Please try again with a different PIN code.');
  }
}

customElements.define('polling-locator', PollingLocator);
export default PollingLocator;
