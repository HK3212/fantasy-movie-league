import './style.css';

// ── Theme Toggle ────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
}

initTheme();

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

// ── Helpers ─────────────────────────────────────────────────────────────
function fmt$(val) {
  if (val == null) return '—';
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtRating(val) {
  if (val == null) return '—';
  return String(val);
}

function fmtPct(val) {
  if (val == null) return '—';
  return Math.round(val) + '%';
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Admin token (stored in memory — lost on reload) ─────────────────────
let adminToken = localStorage.getItem('adminToken') || null;

async function apiGet(url) {
  const headers = {};
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  const res = await fetch(url, { headers });
  return res;
}

async function apiPost(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

// ── Simple SPA Router ───────────────────────────────────────────────────
const content = document.getElementById('content');
const navLinks = document.querySelectorAll('.nav-link');

function getRoute() {
  return window.location.hash.slice(1) || '/';
}

function updateActiveNav(route) {
  navLinks.forEach(link => {
    const href = link.getAttribute('href').slice(1); // remove #
    link.classList.toggle('active', href === route);
  });
}

// ── Page Renderers ──────────────────────────────────────────────────────

async function renderDashboard() {
  content.innerHTML = `
    <div class="page-header fade-in">
      <h1>Dashboard</h1>
      <p>League standings and stats overview</p>
    </div>

    <div class="stats-bar fade-in" style="animation-delay: 0.05s" id="stats-bar">
      <div class="stat-chip">
        <span class="stat-chip-value" id="stat-movies">–</span>
        <span class="stat-chip-label">Movies</span>
      </div>
      <div class="stat-chip">
        <span class="stat-chip-value" id="stat-members">–</span>
        <span class="stat-chip-label">Members</span>
      </div>
      <div class="stat-chip">
        <span class="stat-chip-value" id="stat-season">–</span>
        <span class="stat-chip-label">Active Season</span>
      </div>
    </div>

    <div class="card fade-in" style="animation-delay: 0.1s">
      <div class="card-header">
        <h2 class="card-title">Movies</h2>
        <button class="btn btn-primary" id="add-movie-btn">
          <span>＋</span> Add Movie
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Title</th>
              <th>Owner</th>
              <th>Domestic BO</th>
              <th>Int'l BO</th>
              <th>Opening Wknd</th>
              <th>IMDB</th>
              <th>RT</th>
              <th>Letterboxd</th>
            </tr>
          </thead>
          <tbody id="movies-table-body">
            <tr><td colspan="9" class="table-empty">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Movie Modal -->
    <div class="modal-overlay" id="add-movie-modal" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h2>Add Movie</h2>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Search -->
          <div class="form-group">
            <label for="movie-search-input">Search for a movie</label>
            <input type="text" id="movie-search-input" class="form-input" placeholder="Type a movie name…" autocomplete="off" />
            <div class="search-results" id="search-results" style="display:none"></div>
          </div>

          <!-- Selected movie preview -->
          <div id="selected-movie-preview" style="display:none">
            <div class="selected-movie-card">
              <img id="preview-poster" src="" alt="" class="preview-poster" />
              <div class="preview-info">
                <h3 id="preview-title"></h3>
                <p id="preview-year" class="preview-meta"></p>
                <p id="preview-overview" class="preview-overview"></p>
              </div>
            </div>
          </div>

          <!-- Assignment -->
          <div id="assignment-fields" style="display:none">
            <div class="form-row">
              <div class="form-group">
                <label for="assign-user">Assign to</label>
                <select id="assign-user" class="form-input"></select>
              </div>
              <div class="form-group">
                <label for="assign-period">Draft Period</label>
                <select id="assign-period" class="form-input"></select>
              </div>
              <div class="form-group">
                <label for="assign-bid">Bid Amount ($)</label>
                <input type="number" id="assign-bid" class="form-input" value="0" min="0" step="0.5" />
              </div>
            </div>
          </div>

          <!-- Status message -->
          <div id="add-movie-status" class="status-msg" style="display:none"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-submit" disabled>Add Movie</button>
        </div>
      </div>
    </div>
  `;

  // Fetch & populate stats bar
  try {
    const [moviesRes, usersRes, seasonsRes] = await Promise.all([
      fetch('/api/movies'), fetch('/api/users'), apiGet('/api/seasons'),
    ]);
    const movies = await moviesRes.json();
    const users = await usersRes.json();
    let seasons = [];
    if (seasonsRes.ok) seasons = await seasonsRes.json();

    document.getElementById('stat-movies').textContent = movies.length;
    document.getElementById('stat-members').textContent = users.length;
    const activeSeason = seasons.find(s => s.is_active);
    document.getElementById('stat-season').textContent = activeSeason ? activeSeason.name : 'None';

    // Populate movies table
    const tbody = document.getElementById('movies-table-body');
    if (movies.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="table-empty">No movies yet. Click "Add Movie" to get started.</td></tr>`;
    } else {
      tbody.innerHTML = movies.map(m => `
        <tr>
          <td class="td-poster">${m.poster_url ? `<img src="${m.poster_url}" alt="" class="table-poster" />` : '<div class="table-poster-placeholder">🎬</div>'}</td>
          <td class="td-title">${m.title}${m.release_date ? `<span class="movie-year">(${m.release_date.slice(0,4)})</span>` : ''}</td>
          <td>${m.owner_name ? `<span class="badge badge-cyan">${m.owner_abbrev || m.owner_name}</span>` : '<span class="text-muted">—</span>'}</td>
          <td class="td-num">${fmt$(m.domestic_box_office)}</td>
          <td class="td-num">${fmt$(m.international_box_office)}</td>
          <td class="td-num">${fmt$(m.domestic_opening_weekend)}</td>
          <td class="td-num">${fmtRating(m.imdb_rating)}</td>
          <td class="td-num">${fmtPct(m.rt_score)}</td>
          <td class="td-num">${fmtRating(m.letterboxd_avg_score)}</td>
        </tr>
      `).join('');
    }

    // Setup add movie modal
    setupAddMovieModal(users);
  } catch (err) {
    console.error('Dashboard API error:', err);
  }
}

// ── Add Movie Modal Logic ───────────────────────────────────────────────
function setupAddMovieModal(users) {
  const modal = document.getElementById('add-movie-modal');
  const searchInput = document.getElementById('movie-search-input');
  const searchResults = document.getElementById('search-results');
  const preview = document.getElementById('selected-movie-preview');
  const assignmentFields = document.getElementById('assignment-fields');
  const submitBtn = document.getElementById('modal-submit');
  const statusMsg = document.getElementById('add-movie-status');

  let selectedMovie = null;

  // Open/close modal
  document.getElementById('add-movie-btn').addEventListener('click', async () => {
    modal.style.display = 'flex';
    searchInput.value = '';
    searchResults.style.display = 'none';
    preview.style.display = 'none';
    assignmentFields.style.display = 'none';
    submitBtn.disabled = true;
    statusMsg.style.display = 'none';
    selectedMovie = null;

    // Populate user dropdown
    const userSelect = document.getElementById('assign-user');
    userSelect.innerHTML = users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

    // Populate draft period dropdown (fetch fresh)
    const periodSelect = document.getElementById('assign-period');
    try {
      const res = await apiGet('/api/draft-periods');
      if (res.ok) {
        const periods = await res.json();
        if (periods.length === 0) {
          periodSelect.innerHTML = '<option value="">No draft periods — create one first</option>';
        } else {
          // Default to active period, or latest
          periodSelect.innerHTML = periods.map(p =>
            `<option value="${p.id}" ${p.is_active ? 'selected' : ''}>${p.name} (${p.season_name})</option>`
          ).join('');
        }
      } else {
        periodSelect.innerHTML = '<option value="">Login as admin to see periods</option>';
      }
    } catch {
      periodSelect.innerHTML = '<option value="">Error loading periods</option>';
    }

    setTimeout(() => searchInput.focus(), 100);
  });

  function closeModal() {
    modal.style.display = 'none';
  }

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Search with debounce
  const doSearch = debounce(async (query) => {
    if (query.length < 2) {
      searchResults.style.display = 'none';
      return;
    }

    searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
    searchResults.style.display = 'block';

    try {
      const res = await fetch(`/api/movies/search?query=${encodeURIComponent(query)}`);
      const results = await res.json();

      if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-empty">No movies found</div>';
      } else {
        searchResults.innerHTML = results.slice(0, 8).map(m => `
          <div class="search-result-item" data-tmdb='${JSON.stringify(m).replace(/'/g, "&#39;")}'>
            ${m.poster_thumb ? `<img src="${m.poster_thumb}" alt="" class="search-thumb" />` : '<div class="search-thumb-placeholder">🎬</div>'}
            <div class="search-result-info">
              <span class="search-result-title">${m.title}</span>
              <span class="search-result-year">${m.year || 'TBA'}</span>
            </div>
          </div>
        `).join('');

        // Click handlers
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => selectMovie(JSON.parse(item.dataset.tmdb)));
        });
      }
    } catch (err) {
      searchResults.innerHTML = '<div class="search-empty">Search failed — check API key</div>';
    }
  }, 350);

  searchInput.addEventListener('input', e => doSearch(e.target.value.trim()));

  // Select a movie from search results
  function selectMovie(movie) {
    selectedMovie = movie;
    searchResults.style.display = 'none';
    searchInput.value = movie.title;

    // Show preview
    document.getElementById('preview-poster').src = movie.poster_url || '';
    document.getElementById('preview-poster').style.display = movie.poster_url ? 'block' : 'none';
    document.getElementById('preview-title').textContent = movie.title;
    document.getElementById('preview-year').textContent = movie.year ? `(${movie.year})` : '';
    document.getElementById('preview-overview').textContent = movie.overview
      ? movie.overview.slice(0, 200) + (movie.overview.length > 200 ? '…' : '')
      : '';
    preview.style.display = 'block';
    assignmentFields.style.display = 'block';
    submitBtn.disabled = false;
  }

  // Submit
  submitBtn.addEventListener('click', async () => {
    if (!selectedMovie) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';
    statusMsg.style.display = 'none';

    try {
      // 1. Create movie (auto-fetches from TMDB + OMDb)
      const movieRes = await apiPost('/api/movies', { tmdb_id: selectedMovie.tmdb_id });
      const movieData = await movieRes.json();

      if (!movieRes.ok) {
        showStatus(`Failed: ${movieData.error}`, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Movie';
        return;
      }

      // 2. Create draft pick (assign to user + period)
      const userId = document.getElementById('assign-user').value;
      const periodId = document.getElementById('assign-period').value;
      const bidAmount = parseFloat(document.getElementById('assign-bid').value) || 0;

      if (userId && periodId) {
        const draftRes = await apiPost('/api/drafts', {
          user_id: Number(userId),
          movie_id: movieData.id,
          draft_period_id: Number(periodId),
          bid_amount: bidAmount,
        });

        if (!draftRes.ok) {
          const draftData = await draftRes.json();
          showStatus(`Movie added but draft assignment failed: ${draftData.error}`, 'warning');
        } else {
          showStatus(`${movieData.title} added and assigned!`, 'success');
        }
      } else {
        showStatus(`${movieData.title} added (no draft assignment — no period selected)`, 'success');
      }

      // Refresh the table after a moment
      setTimeout(() => {
        closeModal();
        renderDashboard();
      }, 1200);
    } catch (err) {
      showStatus(`Error: ${err.message}`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Movie';
    }
  });

  function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = `status-msg status-${type}`;
    statusMsg.style.display = 'block';
  }
}

// ── Movies Page ─────────────────────────────────────────────────────────
async function renderMovies() {
  content.innerHTML = `
    <div class="page-header fade-in">
      <h1>Movies</h1>
      <p>All tracked movies and their stats</p>
    </div>
    <div class="movies-grid fade-in" style="animation-delay: 0.1s" id="movies-grid">
      <p class="text-muted">Loading...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/movies');
    const movies = await res.json();
    const grid = document.getElementById('movies-grid');

    if (movies.length === 0) {
      grid.innerHTML = `<div class="card"><p class="text-muted">No movies yet. Add some from the Dashboard.</p></div>`;
      return;
    }

    grid.innerHTML = movies.map(m => `
      <div class="movie-card">
        <div class="movie-card-poster">
          ${m.poster_url ? `<img src="${m.poster_url}" alt="${m.title}" />` : '<div class="movie-card-no-poster">🎬</div>'}
        </div>
        <div class="movie-card-body">
          <h3 class="movie-card-title">${m.title}</h3>
          ${m.release_date ? `<p class="movie-card-year">${m.release_date.slice(0,4)}</p>` : ''}
          ${m.owner_name ? `<span class="badge badge-cyan">${m.owner_name}</span>` : ''}
          <div class="movie-card-stats">
            ${m.imdb_rating != null ? `<span class="movie-stat">⭐ ${m.imdb_rating}</span>` : ''}
            ${m.rt_score != null ? `<span class="movie-stat">🍅 ${Math.round(m.rt_score)}%</span>` : ''}
            ${m.domestic_box_office != null ? `<span class="movie-stat">💰 ${fmt$(m.domestic_box_office)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Movies page error:', err);
  }
}

// ── Members Page ────────────────────────────────────────────────────────
async function renderMembers() {
  content.innerHTML = `
    <div class="page-header fade-in">
      <h1>Members</h1>
      <p>League members and their draft picks</p>
    </div>
    <div id="members-content" class="fade-in" style="animation-delay: 0.1s">
      <p class="text-muted">Loading...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    const container = document.getElementById('members-content');

    if (users.length === 0) {
      container.innerHTML = `<div class="card"><p class="text-muted">No members yet. Seed the league from the Admin page.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="grid grid-3">
        ${users.map(u => `
          <div class="card member-card">
            <div class="member-avatar">${u.abbreviation || u.name.charAt(0)}</div>
            <h3>${u.name}</h3>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Members page error:', err);
  }
}

// ── Admin Page ──────────────────────────────────────────────────────────
async function renderAdmin() {
  content.innerHTML = `
    <div class="page-header fade-in">
      <h1>Admin</h1>
      <p>Manage data, refresh stats, and configure the league</p>
    </div>

    <!-- Login -->
    <div class="card fade-in" style="animation-delay: 0.05s" id="admin-login-card">
      <h2 class="card-title">Admin Login</h2>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <input type="password" id="admin-password" class="form-input" placeholder="Admin password" />
        </div>
        <button class="btn btn-primary" id="admin-login-btn">Login</button>
      </div>
      <p id="admin-login-status" class="status-msg" style="display:none"></p>
    </div>

    <!-- Actions (shown when logged in) -->
    <div id="admin-actions" style="display:none">
      <div class="card fade-in" style="animation-delay: 0.1s">
        <h2 class="card-title">Stats Refresh</h2>
        <p class="text-muted" style="margin-bottom:1rem">Fetch latest IMDB ratings, RT scores, and box office data for all movies.</p>
        <button class="btn btn-primary" id="refresh-all-btn">🔄 Refresh All Stats</button>
        <p id="refresh-status" class="status-msg" style="display:none;margin-top:0.75rem"></p>
      </div>

      <div class="card fade-in" style="animation-delay: 0.15s; margin-top:1.5rem">
        <h2 class="card-title">League Setup</h2>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1rem">
          <button class="btn btn-secondary" id="seed-users-btn">👥 Seed League Members</button>
        </div>
        <p id="setup-status" class="status-msg" style="display:none;margin-top:0.75rem"></p>
      </div>

      <div class="card fade-in" style="animation-delay: 0.2s; margin-top:1.5rem">
        <h2 class="card-title">Database Overview</h2>
        <div id="db-stats-grid" class="stats-bar" style="margin-top:1rem">
          <p class="text-muted">Loading...</p>
        </div>
      </div>
    </div>
  `;

  // Check existing token
  if (adminToken) {
    const checkRes = await fetch('/api/auth/check', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkData = await checkRes.json();
    if (checkData.authenticated) {
      showAdminActions();
    }
  }

  // Login handler
  document.getElementById('admin-login-btn').addEventListener('click', async () => {
    const pw = document.getElementById('admin-password').value;
    const status = document.getElementById('admin-login-status');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();

    if (res.ok) {
      adminToken = data.token;
      localStorage.setItem('adminToken', adminToken);
      status.textContent = 'Logged in!';
      status.className = 'status-msg status-success';
      status.style.display = 'block';
      showAdminActions();
    } else {
      status.textContent = data.error || 'Login failed';
      status.className = 'status-msg status-error';
      status.style.display = 'block';
    }
  });
}

async function showAdminActions() {
  document.getElementById('admin-actions').style.display = 'block';

  // Refresh all stats
  document.getElementById('refresh-all-btn').addEventListener('click', async () => {
    const btn = document.getElementById('refresh-all-btn');
    const status = document.getElementById('refresh-status');
    btn.disabled = true;
    btn.textContent = '⏳ Refreshing…';
    status.style.display = 'none';

    try {
      const res = await apiPost('/api/admin/refresh-all', {});
      const data = await res.json();

      if (res.ok) {
        status.textContent = `✓ ${data.message}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`;
        status.className = 'status-msg status-success';
      } else {
        status.textContent = data.error || 'Refresh failed';
        status.className = 'status-msg status-error';
      }
    } catch (err) {
      status.textContent = err.message;
      status.className = 'status-msg status-error';
    }

    status.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '🔄 Refresh All Stats';
  });

  // Seed users
  document.getElementById('seed-users-btn').addEventListener('click', async () => {
    const status = document.getElementById('setup-status');
    try {
      const res = await fetch('/api/users/seed', { method: 'POST' });
      const data = await res.json();
      status.textContent = `✓ ${data.message}`;
      status.className = 'status-msg status-success';
    } catch (err) {
      status.textContent = err.message;
      status.className = 'status-msg status-error';
    }
    status.style.display = 'block';
  });

  // DB stats
  try {
    const res = await apiGet('/api/admin/db-stats');
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('db-stats-grid').innerHTML = Object.entries(stats).map(([key, val]) => `
        <div class="stat-chip">
          <span class="stat-chip-value">${val}</span>
          <span class="stat-chip-label">${key.replace(/_/g, ' ')}</span>
        </div>
      `).join('');
    }
  } catch {
    // ignore
  }
}

// ── Router ──────────────────────────────────────────────────────────────
const routes = {
  '/': renderDashboard,
  '/movies': renderMovies,
  '/members': renderMembers,
  '/admin': renderAdmin,
};

function navigate() {
  const route = getRoute();
  updateActiveNav(route);
  const render = routes[route] || renderDashboard;
  render();
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);
