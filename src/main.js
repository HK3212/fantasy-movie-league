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

    <div class="card fade-in" style="animation-delay: 0.1s">
      <h2 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Recent Movies</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Domestic BO</th>
              <th>International BO</th>
              <th>Opening Weekend</th>
              <th>IMDB</th>
              <th>RT</th>
              <th>Letterboxd</th>
            </tr>
          </thead>
          <tbody id="movies-table-body">
            <tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Fetch data from API
  try {
    const moviesRes = await fetch('/api/movies');
    const movies = await moviesRes.json();

    const tbody = document.getElementById('movies-table-body');
    if (movies.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No movies yet. Import your spreadsheet from the Admin page.</td></tr>`;
    } else {
      tbody.innerHTML = movies.map(m => `
        <tr>
          <td style="color: var(--text-primary); font-weight: 500;">${m.title}</td>
          <td>${m.domestic_box_office ? '$' + Number(m.domestic_box_office).toLocaleString() : '—'}</td>
          <td>${m.international_box_office ? '$' + Number(m.international_box_office).toLocaleString() : '—'}</td>
          <td>${m.domestic_opening_weekend ? '$' + Number(m.domestic_opening_weekend).toLocaleString() : '—'}</td>
          <td>${m.imdb_rating ?? '—'}</td>
          <td>${m.rt_score != null ? Math.round(m.rt_score * 100) + '%' : '—'}</td>
          <td>${m.letterboxd_avg_score ?? '—'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('API error:', err);
  }
}

function renderMovies() {
  content.innerHTML = `
    <div class="page-header fade-in">
      <h1>Movies</h1>
      <p>All tracked movies and their stats</p>
    </div>
    <div class="card fade-in" style="animation-delay: 0.1s">
      <p style="color: var(--text-muted);">Movie catalog coming soon — this page will show movie cards with posters, stats, and ownership info.</p>
    </div>
  `;
}

function renderMembers() {
  content.innerHTML = `
    <div class="page-header fade-in">
      <h1>Members</h1>
      <p>League members, budgets, and ROTO standings</p>
    </div>
    <div class="card fade-in" style="animation-delay: 0.1s">
      <p style="color: var(--text-muted);">Member profiles coming soon — drafts, auction spend, and per-period ROTO rankings.</p>
    </div>
  `;
}

function renderAdmin() {
  content.innerHTML = `
    <div class="page-header fade-in">
      <h1>Admin</h1>
      <p>Manage data, refresh stats, and import spreadsheets</p>
    </div>
    <div class="card fade-in" style="animation-delay: 0.1s">
      <p style="color: var(--text-muted);">Admin tools coming soon — spreadsheet import, stats refresh, season management.</p>
    </div>
  `;
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
