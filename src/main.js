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
function fmtRating(val) { return val == null ? '—' : String(val); }
function fmtPct(val) { return val == null ? '—' : Math.round(val) + '%'; }
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
function escJson(obj) { return JSON.stringify(obj).replace(/'/g, '&#39;'); }

// ── Admin token ─────────────────────────────────────────────────────────
let adminToken = localStorage.getItem('adminToken') || null;

async function apiGet(url) {
  const headers = {};
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  return fetch(url, { headers });
}
async function apiPost(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}
async function apiPut(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  return fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
}

// ── SPA Router ──────────────────────────────────────────────────────────
const content = document.getElementById('content');
const navLinks = document.querySelectorAll('.nav-link');
function getRoute() { return window.location.hash.slice(1) || '/'; }
function updateActiveNav(route) {
  navLinks.forEach(link => {
    const href = link.getAttribute('href').slice(1);
    link.classList.toggle('active', href === route);
  });
}

// ── Movies Table Helper ─────────────────────────────────────────────────
function populateMoviesTable(movies) {
  const tbody = document.getElementById('movies-table-body');
  if (!tbody) return;
  if (movies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No movies in this period.</td></tr>';
  } else {
    tbody.innerHTML = movies.map(m => `<tr>
      <td class="td-poster">${m.poster_url ? `<img src="${m.poster_url}" alt="" class="table-poster"/>` : '<div class="table-poster-placeholder">🎬</div>'}</td>
      <td class="td-title">${m.title}${m.release_date ? `<span class="movie-year">(${m.release_date.slice(0,4)})</span>` : ''}</td>
      <td>${m.owner_name ? `<span class="badge badge-cyan">${m.owner_abbrev || m.owner_name}</span>` : '<span class="text-muted">—</span>'}</td>
      <td class="td-num">${fmt$(m.domestic_box_office)}</td>
      <td class="td-num">${fmt$(m.international_box_office)}</td>
      <td class="td-num">${fmt$(m.domestic_opening_weekend)}</td>
      <td class="td-num">${fmtRating(m.imdb_rating)}</td>
      <td class="td-num">${fmtPct(m.rt_score)}</td>
      <td class="td-num">${fmtRating(m.letterboxd_avg_score)}</td>
    </tr>`).join('');
  }
}

// ── Leaderboard Helper ──────────────────────────────────────────────────
async function loadLeaderboard(periodId) {
  const body = document.getElementById('leaderboard-body');
  if (!body) return;
  try {
    const res = await apiGet(`/api/draft-periods/${periodId}/standings`);
    if (!res.ok) { body.innerHTML = '<p class="text-muted" style="padding:1rem">Could not load standings.</p>'; return; }
    const data = await res.json();
    if (!data.standings || data.standings.length === 0) {
      body.innerHTML = '<p class="text-muted" style="padding:1rem">No standings yet — add movies first.</p>';
      return;
    }
    const catLabels = { domestic_box_office:'Dom BO', international_box_office:"Int'l BO", domestic_opening_weekend:'Open Wknd', letterboxd_avg_score:'LB', letterboxd_members_rated:'LB #', rt_score:'RT', imdb_rating:'IMDB' };
    const cats = data.categories || Object.keys(catLabels);
    const medals = ['🥇','🥈','🥉'];
    body.innerHTML = `<div class="table-wrap"><table class="leaderboard-table">
      <thead><tr><th style="text-align:center">#</th><th>Member</th>
      ${cats.map(c=>`<th style="text-align:center">${catLabels[c]||c}</th>`).join('')}
      <th style="text-align:center">Total</th></tr></thead>
      <tbody>${data.standings.map((s,i)=>{
        const cs = s.movies.reduce((a,mv)=>{ for(const c of cats) a[c]=(a[c]||0)+(mv.ranks[c]||0); return a; },{});
        return `<tr class="${i===0?'leaderboard-row-first':''}">
          <td class="leaderboard-rank ${i<3?`leaderboard-rank-${i+1}`:''}">${i<3?medals[i]:i+1}</td>
          <td><div class="leaderboard-user"><div class="leaderboard-avatar">${s.abbreviation||s.user_name.charAt(0)}</div>${s.user_name}</div></td>
          ${cats.map(c=>`<td class="leaderboard-cat-score">${cs[c]||0}</td>`).join('')}
          <td class="leaderboard-total">${s.totalRoto}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  } catch { body.innerHTML = '<p class="text-muted" style="padding:1rem">Error loading standings.</p>'; }
}

// ── Dashboard ───────────────────────────────────────────────────────────
async function renderDashboard() {
  content.innerHTML = `
    <div class="page-header fade-in"><h1>Dashboard</h1><p>League standings and stats overview</p></div>
    <div class="stats-bar fade-in" style="animation-delay:0.05s" id="stats-bar">
      <div class="stat-chip"><span class="stat-chip-value" id="stat-movies">–</span><span class="stat-chip-label">Movies</span></div>
      <div class="stat-chip"><span class="stat-chip-value" id="stat-members">–</span><span class="stat-chip-label">Members</span></div>
      <div class="stat-chip"><span class="stat-chip-value" id="stat-season">–</span><span class="stat-chip-label">Active Season</span></div>
    </div>
    <div id="dash-period-area"></div>
    <div id="dash-leaderboard-area"></div>
    <div class="card fade-in" style="animation-delay:0.1s">
      <div class="card-header"><h2 class="card-title">Movies</h2>
        <button class="btn btn-primary" id="add-movie-btn"><span>＋</span> Add Movie</button></div>
      <div class="table-wrap"><table><thead><tr>
        <th></th><th>Title</th><th>Owner</th><th>Domestic BO</th><th>Int'l BO</th><th>Opening Wknd</th><th>IMDB</th><th>RT</th><th>Letterboxd</th>
      </tr></thead><tbody id="movies-table-body"><tr><td colspan="9" class="table-empty">Loading...</td></tr></tbody></table></div>
    </div>
    <div class="modal-overlay" id="add-movie-modal" style="display:none"><div class="modal">
      <div class="modal-header"><h2>Add Movie</h2><button class="modal-close" id="modal-close">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label for="movie-search-input">Search for a movie</label>
          <input type="text" id="movie-search-input" class="form-input" placeholder="Type a movie name…" autocomplete="off"/>
          <div class="search-results" id="search-results" style="display:none"></div></div>
        <div id="selected-movie-preview" style="display:none"><div class="selected-movie-card">
          <img id="preview-poster" src="" alt="" class="preview-poster"/>
          <div class="preview-info"><h3 id="preview-title"></h3><p id="preview-year" class="preview-meta"></p><p id="preview-overview" class="preview-overview"></p></div>
        </div></div>
        <div id="assignment-fields" style="display:none"><div class="form-row">
          <div class="form-group"><label for="assign-user">Assign to</label><select id="assign-user" class="form-input"></select></div>
          <div class="form-group"><label for="assign-period">Draft Period</label><select id="assign-period" class="form-input"></select></div>
          <div class="form-group"><label for="assign-bid">Bid Amount ($)</label><input type="number" id="assign-bid" class="form-input" value="0" min="0" step="0.5"/></div>
        </div></div>
        <div id="add-movie-status" class="status-msg" style="display:none"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-submit" disabled>Add Movie</button></div>
    </div></div>`;

  try {
    const [moviesRes, usersRes, seasonsRes, periodsRes] = await Promise.all([
      fetch('/api/movies'), fetch('/api/users'), apiGet('/api/seasons'), apiGet('/api/draft-periods'),
    ]);
    const movies = await moviesRes.json();
    const users = await usersRes.json();
    let seasons = []; if (seasonsRes.ok) seasons = await seasonsRes.json();
    let periods = []; if (periodsRes.ok) periods = await periodsRes.json();

    document.getElementById('stat-movies').textContent = movies.length;
    document.getElementById('stat-members').textContent = users.length;
    const activeSeason = seasons.find(s => s.is_active);
    document.getElementById('stat-season').textContent = activeSeason ? activeSeason.name : 'None';

    if (periods.length > 0) {
      const activePeriod = periods.find(p => p.is_active) || periods[0];
      document.getElementById('dash-period-area').innerHTML = `<div class="period-selector fade-in" style="animation-delay:0.08s">
        <label for="dash-period-select">Draft Period</label>
        <select id="dash-period-select"><option value="all">All Periods</option>
        ${periods.map(p=>`<option value="${p.id}" ${p.id===activePeriod.id?'selected':''}>${p.name}</option>`).join('')}</select></div>`;
      document.getElementById('dash-leaderboard-area').innerHTML = `<div class="card fade-in leaderboard-wrap" style="animation-delay:0.09s">
        <div class="card-header"><h2 class="card-title">ROTO Standings</h2></div><div id="leaderboard-body"><p class="text-muted" style="padding:1rem">Loading…</p></div></div>`;

      await loadLeaderboard(activePeriod.id);
      const filtered = movies.filter(m => String(m.draft_period_id) === String(activePeriod.id));
      populateMoviesTable(filtered.length > 0 ? filtered : movies);
      if (filtered.length === 0) document.getElementById('dash-period-select').value = 'all';

      document.getElementById('dash-period-select').addEventListener('change', async (e) => {
        const v = e.target.value;
        if (v === 'all') { populateMoviesTable(movies); document.getElementById('leaderboard-body').innerHTML = '<p class="text-muted" style="padding:1rem">Select a period to view standings.</p>'; }
        else { populateMoviesTable(movies.filter(m => String(m.draft_period_id) === v)); await loadLeaderboard(Number(v)); }
      });
    } else { populateMoviesTable(movies); }
    setupAddMovieModal(users);
  } catch (err) { console.error('Dashboard API error:', err); }
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

  document.getElementById('add-movie-btn').addEventListener('click', async () => {
    modal.style.display = 'flex'; searchInput.value = ''; searchResults.style.display = 'none';
    preview.style.display = 'none'; assignmentFields.style.display = 'none';
    submitBtn.disabled = true; statusMsg.style.display = 'none'; selectedMovie = null;
    document.getElementById('assign-user').innerHTML = users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    const periodSelect = document.getElementById('assign-period');
    try {
      const res = await apiGet('/api/draft-periods');
      if (res.ok) {
        const periods = await res.json();
        periodSelect.innerHTML = periods.length === 0 ? '<option value="">No draft periods</option>'
          : periods.map(p => `<option value="${p.id}" ${p.is_active?'selected':''}>${p.name} (${p.season_name})</option>`).join('');
      } else { periodSelect.innerHTML = '<option value="">Login as admin</option>'; }
    } catch { periodSelect.innerHTML = '<option value="">Error</option>'; }
    setTimeout(() => searchInput.focus(), 100);
  });

  const closeModal = () => { modal.style.display = 'none'; };
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  const doSearch = debounce(async (query) => {
    if (query.length < 2) { searchResults.style.display = 'none'; return; }
    searchResults.innerHTML = '<div class="search-loading">Searching...</div>'; searchResults.style.display = 'block';
    try {
      const res = await fetch(`/api/movies/search?query=${encodeURIComponent(query)}`);
      const results = await res.json();
      if (results.length === 0) { searchResults.innerHTML = '<div class="search-empty">No movies found</div>'; }
      else {
        searchResults.innerHTML = results.slice(0, 8).map(m => `<div class="search-result-item" data-tmdb='${escJson(m)}'>
          ${m.poster_thumb ? `<img src="${m.poster_thumb}" alt="" class="search-thumb"/>` : '<div class="search-thumb-placeholder">🎬</div>'}
          <div class="search-result-info"><span class="search-result-title">${m.title}</span><span class="search-result-year">${m.year||'TBA'}</span></div>
        </div>`).join('');
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => selectMovie(JSON.parse(item.dataset.tmdb)));
        });
      }
    } catch { searchResults.innerHTML = '<div class="search-empty">Search failed</div>'; }
  }, 350);
  searchInput.addEventListener('input', e => doSearch(e.target.value.trim()));

  function selectMovie(movie) {
    selectedMovie = movie; searchResults.style.display = 'none'; searchInput.value = movie.title;
    document.getElementById('preview-poster').src = movie.poster_url || '';
    document.getElementById('preview-poster').style.display = movie.poster_url ? 'block' : 'none';
    document.getElementById('preview-title').textContent = movie.title;
    document.getElementById('preview-year').textContent = movie.year ? `(${movie.year})` : '';
    document.getElementById('preview-overview').textContent = movie.overview ? movie.overview.slice(0, 200) + (movie.overview.length > 200 ? '…' : '') : '';
    preview.style.display = 'block'; assignmentFields.style.display = 'block'; submitBtn.disabled = false;
  }

  submitBtn.addEventListener('click', async () => {
    if (!selectedMovie) return;
    submitBtn.disabled = true; submitBtn.textContent = 'Adding…'; statusMsg.style.display = 'none';
    try {
      const movieRes = await apiPost('/api/movies', { tmdb_id: selectedMovie.tmdb_id });
      const movieData = await movieRes.json();
      if (!movieRes.ok) { showStatus(`Failed: ${movieData.error}`, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Add Movie'; return; }
      const userId = document.getElementById('assign-user').value;
      const periodId = document.getElementById('assign-period').value;
      const bidAmount = parseFloat(document.getElementById('assign-bid').value) || 0;
      if (userId && periodId) {
        const draftRes = await apiPost('/api/drafts', { user_id: Number(userId), movie_id: movieData.id, draft_period_id: Number(periodId), bid_amount: bidAmount });
        if (!draftRes.ok) { const d = await draftRes.json(); showStatus(`Movie added but draft failed: ${d.error}`, 'warning'); }
        else { showStatus(`${movieData.title} added and assigned!`, 'success'); }
      } else { showStatus(`${movieData.title} added (no assignment)`, 'success'); }
      setTimeout(() => { closeModal(); renderDashboard(); }, 1200);
    } catch (err) { showStatus(`Error: ${err.message}`, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Add Movie'; }
  });

  function showStatus(msg, type) { statusMsg.textContent = msg; statusMsg.className = `status-msg status-${type}`; statusMsg.style.display = 'block'; }
}

// ── Movies Page ─────────────────────────────────────────────────────────
async function renderMovies() {
  content.innerHTML = `
    <div class="page-header fade-in"><h1>Movies</h1><p>All tracked movies and their stats</p></div>
    <div class="filter-bar fade-in" style="animation-delay:0.05s" id="movies-filter-bar">
      <input type="text" class="filter-input" id="filter-title" placeholder="Search by title…"/>
      <select class="filter-select" id="filter-owner"><option value="">All Owners</option></select>
      <select class="filter-select" id="filter-period"><option value="">All Periods</option></select>
      <span class="filter-count" id="filter-count"></span>
    </div>
    <div class="movies-grid fade-in" style="animation-delay:0.1s" id="movies-grid"><p class="text-muted">Loading...</p></div>
    <div class="modal-overlay" id="movie-detail-modal" style="display:none"><div class="modal modal-large">
      <div class="modal-header"><h2 id="detail-modal-title">Movie Details</h2><button class="modal-close" id="detail-modal-close">&times;</button></div>
      <div class="modal-body" id="detail-modal-body"></div>
      <div class="modal-footer"><button class="btn btn-secondary" id="detail-modal-done">Close</button></div>
    </div></div>`;

  try {
    const [moviesRes, usersRes, periodsRes] = await Promise.all([
      fetch('/api/movies'), fetch('/api/users'), apiGet('/api/draft-periods'),
    ]);
    const movies = await moviesRes.json();
    const users = await usersRes.json();
    let periods = []; if (periodsRes.ok) periods = await periodsRes.json();

    // Populate filter dropdowns
    document.getElementById('filter-owner').innerHTML = '<option value="">All Owners</option>' +
      users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    document.getElementById('filter-period').innerHTML = '<option value="">All Periods</option>' +
      periods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    let allMovies = movies;
    function applyFilters() {
      const title = document.getElementById('filter-title').value.toLowerCase();
      const owner = document.getElementById('filter-owner').value;
      const period = document.getElementById('filter-period').value;
      let filtered = allMovies;
      if (title) filtered = filtered.filter(m => m.title.toLowerCase().includes(title));
      if (owner) filtered = filtered.filter(m => String(m.owner_id) === owner);
      if (period) filtered = filtered.filter(m => String(m.draft_period_id) === period);
      renderMovieGrid(filtered);
      document.getElementById('filter-count').textContent = `${filtered.length} movie${filtered.length !== 1 ? 's' : ''}`;
    }

    document.getElementById('filter-title').addEventListener('input', applyFilters);
    document.getElementById('filter-owner').addEventListener('change', applyFilters);
    document.getElementById('filter-period').addEventListener('change', applyFilters);

    function renderMovieGrid(list) {
      const grid = document.getElementById('movies-grid');
      if (list.length === 0) { grid.innerHTML = '<div class="card"><p class="text-muted">No movies match your filters.</p></div>'; return; }
      grid.innerHTML = list.map(m => `<div class="movie-card" data-movie-id="${m.id}">
        <div class="movie-card-poster">${m.poster_url ? `<img src="${m.poster_url}" alt="${m.title}"/>` : '<div class="movie-card-no-poster">🎬</div>'}</div>
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
      </div>`).join('');
      // Click handlers for detail modal
      grid.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
          const movie = allMovies.find(m => String(m.id) === card.dataset.movieId);
          if (movie) openMovieDetail(movie);
        });
      });
    }

    function openMovieDetail(m) {
      const modal = document.getElementById('movie-detail-modal');
      document.getElementById('detail-modal-title').textContent = m.title;
      document.getElementById('detail-modal-body').innerHTML = `
        <div class="movie-detail-hero">
          ${m.poster_url ? `<img src="${m.poster_url}" alt="" class="movie-detail-poster"/>` : '<div class="movie-detail-poster-placeholder">🎬</div>'}
          <div class="movie-detail-info">
            <div class="movie-detail-title">${m.title}</div>
            <div class="movie-detail-meta">
              ${m.release_date ? `<span class="movie-detail-year">${m.release_date.slice(0,4)}</span>` : ''}
              ${m.owner_name ? `<span class="badge badge-cyan">${m.owner_name}</span>` : ''}
              ${m.draft_period_name ? `<span class="badge badge-amber">${m.draft_period_name}</span>` : ''}
            </div>
          </div>
        </div>
        ${m.owner_name ? `<div class="movie-detail-owner">
          <span class="movie-detail-owner-label">Drafted by</span>
          <span style="font-weight:600">${m.owner_name}</span>
          ${m.bid_amount ? `<span class="text-muted">· $${m.bid_amount}</span>` : ''}
        </div>` : ''}
        <div class="stat-grid">
          <div class="stat-grid-item"><span class="stat-grid-label">Domestic BO</span><span class="stat-grid-value">${fmt$(m.domestic_box_office)}</span></div>
          <div class="stat-grid-item"><span class="stat-grid-label">Int'l BO</span><span class="stat-grid-value">${fmt$(m.international_box_office)}</span></div>
          <div class="stat-grid-item"><span class="stat-grid-label">Opening Weekend</span><span class="stat-grid-value">${fmt$(m.domestic_opening_weekend)}</span></div>
          <div class="stat-grid-item"><span class="stat-grid-label">IMDB Rating</span><span class="stat-grid-value">${fmtRating(m.imdb_rating)}</span></div>
          <div class="stat-grid-item"><span class="stat-grid-label">RT Score</span><span class="stat-grid-value">${fmtPct(m.rt_score)}</span></div>
          <div class="stat-grid-item"><span class="stat-grid-label">Letterboxd</span><span class="stat-grid-value">${fmtRating(m.letterboxd_avg_score)}</span></div>
        </div>
        <div class="movie-detail-actions">
          <button class="btn btn-secondary btn-sm" id="detail-refresh-btn">🔄 Refresh Stats</button>
        </div>
        <div id="detail-refresh-status" class="status-msg" style="display:none;margin-top:0.75rem"></div>`;
      modal.style.display = 'flex';

      document.getElementById('detail-refresh-btn').addEventListener('click', async () => {
        const btn = document.getElementById('detail-refresh-btn');
        const status = document.getElementById('detail-refresh-status');
        btn.disabled = true; btn.textContent = '⏳ Refreshing…';
        try {
          const res = await apiPost(`/api/admin/refresh/${m.id}`, {});
          const data = await res.json();
          if (res.ok) { status.textContent = '✓ Stats refreshed!'; status.className = 'status-msg status-success'; }
          else { status.textContent = data.error || 'Failed'; status.className = 'status-msg status-error'; }
        } catch (err) { status.textContent = err.message; status.className = 'status-msg status-error'; }
        status.style.display = 'block'; btn.disabled = false; btn.textContent = '🔄 Refresh Stats';
      });

      const closeDetail = () => { modal.style.display = 'none'; };
      document.getElementById('detail-modal-close').addEventListener('click', closeDetail);
      document.getElementById('detail-modal-done').addEventListener('click', closeDetail);
      modal.addEventListener('click', e => { if (e.target === modal) closeDetail(); });
    }

    applyFilters();
  } catch (err) { console.error('Movies page error:', err); }
}

// ── Members Page ────────────────────────────────────────────────────────
async function renderMembers() {
  content.innerHTML = `
    <div class="page-header fade-in"><h1>Members</h1><p>League members and their draft picks</p></div>
    <div id="members-content" class="fade-in" style="animation-delay:0.1s"><p class="text-muted">Loading...</p></div>`;

  try {
    const [usersRes, draftsRes, periodsRes] = await Promise.all([
      fetch('/api/users'), apiGet('/api/drafts'), apiGet('/api/draft-periods'),
    ]);
    const users = await usersRes.json();
    let allDrafts = [];
    try { const d = await draftsRes.json(); if (Array.isArray(d)) allDrafts = d; } catch {}
    let periods = []; if (periodsRes.ok) { try { const p = await periodsRes.json(); if (Array.isArray(p)) periods = p; } catch {} }
    const container = document.getElementById('members-content');

    if (users.length === 0) { container.innerHTML = '<div class="card"><p class="text-muted">No members. Seed from Admin page.</p></div>'; return; }

    // Fetch budget data for each period
    const periodData = {};
    for (const p of periods) {
      try {
        const res = await apiGet(`/api/draft-periods/${p.id}`);
        if (res.ok) periodData[p.id] = await res.json();
      } catch {}
    }

    container.innerHTML = `
      <div class="grid grid-3" id="member-cards">${users.map(u => {
        const userDrafts = allDrafts.filter(d => d.user_id === u.id);
        return `<div class="card member-card" data-user-id="${u.id}">
          <div class="member-avatar">${u.abbreviation || u.name.charAt(0)}</div>
          <h3>${u.name}</h3>
          <div class="member-roto">${userDrafts.length} movie${userDrafts.length !== 1 ? 's' : ''} drafted</div>
        </div>`;
      }).join('')}</div>
      <div id="member-detail-area"></div>`;

    document.querySelectorAll('.member-card').forEach(card => {
      card.addEventListener('click', () => {
        const userId = Number(card.dataset.userId);
        const user = users.find(u => u.id === userId);
        document.querySelectorAll('.member-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderMemberDetail(user, allDrafts.filter(d => d.user_id === userId), periods, periodData);
      });
    });
  } catch (err) { console.error('Members page error:', err); }
}

function renderMemberDetail(user, userDrafts, periods, periodData) {
  const area = document.getElementById('member-detail-area');
  if (!area) return;
  area.innerHTML = `<div class="member-detail fade-in">
    <div class="member-detail-header">
      <div class="member-avatar">${user.abbreviation || user.name.charAt(0)}</div>
      <div class="member-detail-name">${user.name}</div>
    </div>
    ${periods.map(p => {
      const pd = periodData[p.id];
      const budgetInfo = pd?.budgets?.find(b => b.user_id === user.id);
      const pMovies = userDrafts.filter(d => d.draft_period_id === p.id);
      const budget = budgetInfo?.budget || 100;
      const spent = budgetInfo?.amount_spent || 0;
      const pct = Math.min(100, (spent / budget) * 100);
      return `<div class="member-period-section">
        <div class="member-period-header" data-period="${p.id}">
          <h4>${p.name} <span class="text-muted">(${pMovies.length} movie${pMovies.length!==1?'s':''})</span></h4>
          <span class="member-period-toggle">▼</span>
        </div>
        <div class="member-period-body" id="period-body-${p.id}">
          <div class="member-period-content">
            <div class="budget-bar-wrap">
              <div class="budget-bar-labels"><span>$${spent.toFixed(1)} spent</span><span>$${budget.toFixed(1)} budget</span></div>
              <div class="budget-bar"><div class="budget-bar-fill ${pct>100?'over-budget':''}" style="width:${pct}%"></div></div>
            </div>
            <div class="budget-stats">
              <div class="budget-stat"><span class="budget-stat-label">Budget</span><span class="budget-stat-value">$${budget.toFixed(1)}</span></div>
              <div class="budget-stat"><span class="budget-stat-label">Spent</span><span class="budget-stat-value">$${spent.toFixed(1)}</span></div>
              <div class="budget-stat"><span class="budget-stat-label">Remaining</span><span class="budget-stat-value">$${(budget - spent).toFixed(1)}</span></div>
              ${budgetInfo?.carryover_in ? `<div class="budget-stat"><span class="budget-stat-label">Carryover In</span><span class="budget-stat-value">$${budgetInfo.carryover_in.toFixed(1)}</span></div>` : ''}
            </div>
            ${pMovies.length > 0 ? `<div class="member-movie-list">${pMovies.map(d => `<div class="member-movie-item">
              ${d.poster_url ? `<img src="${d.poster_url}" alt="" class="member-movie-thumb"/>` : ''}
              <div class="member-movie-info"><div class="member-movie-title">${d.title}</div><div class="member-movie-bid">Bid: $${d.bid_amount || 0}</div></div>
            </div>`).join('')}</div>` : '<p class="text-muted">No movies drafted in this period.</p>'}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Toggle collapsible sections
  area.querySelectorAll('.member-period-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = document.getElementById(`period-body-${header.dataset.period}`);
      const toggle = header.querySelector('.member-period-toggle');
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    });
  });
  // Auto-open first section
  const firstBody = area.querySelector('.member-period-body');
  const firstToggle = area.querySelector('.member-period-toggle');
  if (firstBody) { firstBody.classList.add('open'); firstToggle?.classList.add('open'); }
}

// ── Admin Page ──────────────────────────────────────────────────────────
async function renderAdmin() {
  content.innerHTML = `
    <div class="page-header fade-in"><h1>Admin</h1><p>Manage data, refresh stats, and configure the league</p></div>
    <div class="card fade-in" style="animation-delay:0.05s" id="admin-login-card">
      <h2 class="card-title">Admin Login</h2>
      <div class="form-row">
        <div class="form-group" style="flex:1"><input type="password" id="admin-password" class="form-input" placeholder="Admin password"/></div>
        <button class="btn btn-primary" id="admin-login-btn">Login</button>
      </div>
      <p id="admin-login-status" class="status-msg" style="display:none"></p>
    </div>
    <div id="admin-actions" style="display:none">
      <div class="card fade-in" style="animation-delay:0.1s">
        <h2 class="card-title">Season Management</h2>
        <div class="admin-form-inline" id="create-season-form">
          <div class="form-group"><label>Name</label><input type="text" id="season-name" class="form-input" placeholder="e.g. 2026"/></div>
          <div class="form-group"><label>Year</label><input type="number" id="season-year" class="form-input" placeholder="2026"/></div>
          <button class="btn btn-primary btn-sm" id="create-season-btn">Create Season</button>
        </div>
        <div class="management-list" id="seasons-list"><p class="text-muted">Loading...</p></div>
        <p id="season-status" class="status-msg" style="display:none;margin-top:0.75rem"></p>
      </div>
      <div class="card fade-in" style="animation-delay:0.15s;margin-top:1.5rem">
        <h2 class="card-title">Draft Period Management</h2>
        <div class="admin-form-inline" id="create-period-form">
          <div class="form-group"><label>Name</label><input type="text" id="period-name" class="form-input" placeholder="e.g. Jan-Mar"/></div>
          <div class="form-group"><label>Season</label><select id="period-season" class="form-input"></select></div>
          <div class="form-group"><label>Budget</label><input type="number" id="period-budget" class="form-input" value="100"/></div>
          <button class="btn btn-primary btn-sm" id="create-period-btn">Create Period</button>
        </div>
        <div class="management-list" id="periods-list"><p class="text-muted">Loading...</p></div>
        <p id="period-status" class="status-msg" style="display:none;margin-top:0.75rem"></p>
      </div>
      <div class="card fade-in" style="animation-delay:0.2s;margin-top:1.5rem">
        <h2 class="card-title">Stats Refresh</h2>
        <p class="text-muted" style="margin-bottom:1rem">Fetch latest ratings and box office data for all movies.</p>
        <button class="btn btn-primary" id="refresh-all-btn">🔄 Refresh All Stats</button>
        <p id="refresh-status" class="status-msg" style="display:none;margin-top:0.75rem"></p>
      </div>
      <div class="card fade-in" style="animation-delay:0.25s;margin-top:1.5rem">
        <h2 class="card-title">League Setup</h2>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1rem">
          <button class="btn btn-secondary" id="seed-users-btn">👥 Seed League Members</button>
        </div>
        <p id="setup-status" class="status-msg" style="display:none;margin-top:0.75rem"></p>
      </div>
      <div class="card fade-in" style="animation-delay:0.3s;margin-top:1.5rem">
        <h2 class="card-title">Database Overview</h2>
        <div id="db-stats-grid" class="stats-bar" style="margin-top:1rem"><p class="text-muted">Loading...</p></div>
      </div>
    </div>`;

  if (adminToken) {
    try {
      const checkRes = await fetch('/api/auth/check', { headers: { Authorization: `Bearer ${adminToken}` } });
      const checkData = await checkRes.json();
      if (checkData.authenticated) showAdminActions();
    } catch {}
  }

  document.getElementById('admin-login-btn').addEventListener('click', async () => {
    const pw = document.getElementById('admin-password').value;
    const status = document.getElementById('admin-login-status');
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const data = await res.json();
    if (res.ok) {
      adminToken = data.token; localStorage.setItem('adminToken', adminToken);
      status.textContent = 'Logged in!'; status.className = 'status-msg status-success'; status.style.display = 'block';
      showAdminActions();
    } else { status.textContent = data.error || 'Login failed'; status.className = 'status-msg status-error'; status.style.display = 'block'; }
  });
}

async function showAdminActions() {
  document.getElementById('admin-actions').style.display = 'block';
  await loadSeasonsAndPeriods();

  // Refresh all stats
  document.getElementById('refresh-all-btn').addEventListener('click', async () => {
    const btn = document.getElementById('refresh-all-btn');
    const status = document.getElementById('refresh-status');
    btn.disabled = true; btn.textContent = '⏳ Refreshing…'; status.style.display = 'none';
    try {
      const res = await apiPost('/api/admin/refresh-all', {});
      const data = await res.json();
      status.textContent = res.ok ? `✓ ${data.message}${data.failed>0?` (${data.failed} failed)`:''}` : (data.error||'Failed');
      status.className = `status-msg status-${res.ok?'success':'error'}`;
    } catch (err) { status.textContent = err.message; status.className = 'status-msg status-error'; }
    status.style.display = 'block'; btn.disabled = false; btn.textContent = '🔄 Refresh All Stats';
  });

  // Seed users
  document.getElementById('seed-users-btn').addEventListener('click', async () => {
    const status = document.getElementById('setup-status');
    try {
      const res = await fetch('/api/users/seed', { method: 'POST' });
      const data = await res.json();
      status.textContent = `✓ ${data.message}`; status.className = 'status-msg status-success';
    } catch (err) { status.textContent = err.message; status.className = 'status-msg status-error'; }
    status.style.display = 'block';
  });

  // DB stats
  try {
    const res = await apiGet('/api/admin/db-stats');
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('db-stats-grid').innerHTML = Object.entries(stats).map(([key, val]) =>
        `<div class="stat-chip"><span class="stat-chip-value">${val}</span><span class="stat-chip-label">${key.replace(/_/g,' ')}</span></div>`
      ).join('');
    }
  } catch {}
}

async function loadSeasonsAndPeriods() {
  // Load seasons
  try {
    const res = await apiGet('/api/seasons');
    if (res.ok) {
      const seasons = await res.json();
      document.getElementById('seasons-list').innerHTML = seasons.length === 0 ? '<p class="text-muted">No seasons yet.</p>'
        : seasons.map(s => `<div class="management-item">
          <div class="management-item-info">
            <span class="management-item-name">${s.name}</span>
            <span class="management-item-meta">${s.year}</span>
          </div>
          <div class="management-item-actions">
            ${s.is_active ? '<span class="badge badge-green">Active</span>' : `<button class="btn btn-sm btn-secondary set-active-season" data-id="${s.id}">Set Active</button>`}
          </div>
        </div>`).join('');
      // Populate period season dropdown
      document.getElementById('period-season').innerHTML = seasons.map(s => `<option value="${s.id}">${s.name} (${s.year})</option>`).join('');
      // Set active handlers
      document.querySelectorAll('.set-active-season').forEach(btn => {
        btn.addEventListener('click', async () => {
          await apiPut(`/api/seasons/${btn.dataset.id}`, { is_active: 1 });
          // Deactivate others
          for (const s of seasons) { if (String(s.id) !== btn.dataset.id) await apiPut(`/api/seasons/${s.id}`, { is_active: 0 }); }
          loadSeasonsAndPeriods();
        });
      });
    }
  } catch {}

  // Load periods
  try {
    const res = await apiGet('/api/draft-periods');
    if (res.ok) {
      const periods = await res.json();
      document.getElementById('periods-list').innerHTML = periods.length === 0 ? '<p class="text-muted">No draft periods yet.</p>'
        : periods.map(p => `<div class="management-item">
          <div class="management-item-info">
            <span class="management-item-name">${p.name}</span>
            <span class="management-item-meta">${p.season_name} · Budget: $${p.auction_budget}</span>
          </div>
          <div class="management-item-actions">
            ${p.is_active ? '<span class="badge badge-green">Active</span>' : `<button class="btn btn-sm btn-secondary set-active-period" data-id="${p.id}">Set Active</button>`}
          </div>
        </div>`).join('');
      document.querySelectorAll('.set-active-period').forEach(btn => {
        btn.addEventListener('click', async () => {
          const periods2 = await (await apiGet('/api/draft-periods')).json();
          for (const p of periods2) await apiPut(`/api/draft-periods/${p.id}`, { is_active: String(p.id) === btn.dataset.id ? 1 : 0 });
          loadSeasonsAndPeriods();
        });
      });
    }
  } catch {}

  // Create season handler
  document.getElementById('create-season-btn').addEventListener('click', async () => {
    const name = document.getElementById('season-name').value.trim();
    const year = parseInt(document.getElementById('season-year').value);
    const status = document.getElementById('season-status');
    if (!name || !year) { status.textContent = 'Name and year required'; status.className = 'status-msg status-error'; status.style.display = 'block'; return; }
    const res = await apiPost('/api/seasons', { name, year });
    const data = await res.json();
    if (res.ok) { status.textContent = `✓ Season "${name}" created`; status.className = 'status-msg status-success'; document.getElementById('season-name').value = ''; document.getElementById('season-year').value = ''; loadSeasonsAndPeriods(); }
    else { status.textContent = data.error || 'Failed'; status.className = 'status-msg status-error'; }
    status.style.display = 'block';
  });

  // Create period handler
  document.getElementById('create-period-btn').addEventListener('click', async () => {
    const name = document.getElementById('period-name').value.trim();
    const seasonId = document.getElementById('period-season').value;
    const budget = parseFloat(document.getElementById('period-budget').value) || 100;
    const status = document.getElementById('period-status');
    if (!name || !seasonId) { status.textContent = 'Name and season required'; status.className = 'status-msg status-error'; status.style.display = 'block'; return; }
    const res = await apiPost('/api/draft-periods', { name, season_id: Number(seasonId), auction_budget: budget });
    const data = await res.json();
    if (res.ok) { status.textContent = `✓ Period "${name}" created`; status.className = 'status-msg status-success'; document.getElementById('period-name').value = ''; loadSeasonsAndPeriods(); }
    else { status.textContent = data.error || 'Failed'; status.className = 'status-msg status-error'; }
    status.style.display = 'block';
  });
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
