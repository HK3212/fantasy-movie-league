/**
 * TMDB API service — movie search, details, and external IDs.
 *
 * Uses the TMDB v3 API with a v4 Bearer token for auth.
 * Docs: https://developer.themoviedb.org/reference
 */
import axios from 'axios';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

function getToken() {
  const token = process.env.TMDB_API_KEY;
  if (!token) throw new Error('TMDB_API_KEY not configured in .env');
  return token;
}

function client() {
  return axios.create({
    baseURL: TMDB_BASE,
    headers: { Authorization: `Bearer ${getToken()}` },
    timeout: 8000,
  });
}

/**
 * Search movies by title. Returns a simplified list.
 * @param {string} query — search text
 * @param {number} [page=1]
 * @returns {Promise<Array<{tmdb_id, title, release_date, poster_url, overview}>>}
 */
export async function searchMovies(query, page = 1) {
  const { data } = await client().get('/search/movie', {
    params: { query, page, include_adult: false },
  });

  return data.results.map(m => ({
    tmdb_id: m.id,
    title: m.title,
    release_date: m.release_date || null,
    poster_url: m.poster_path ? `${TMDB_IMG}/w342${m.poster_path}` : null,
    poster_thumb: m.poster_path ? `${TMDB_IMG}/w92${m.poster_path}` : null,
    overview: m.overview || '',
    year: m.release_date ? m.release_date.slice(0, 4) : null,
  }));
}

/**
 * Get full movie details from TMDB, including revenue.
 * @param {number} tmdbId
 * @returns {Promise<Object>}
 */
export async function getMovieDetails(tmdbId) {
  const { data } = await client().get(`/movie/${tmdbId}`);

  return {
    tmdb_id: data.id,
    title: data.title,
    release_date: data.release_date || null,
    poster_url: data.poster_path ? `${TMDB_IMG}/w342${data.poster_path}` : null,
    overview: data.overview || '',
    runtime: data.runtime,
    revenue: data.revenue || 0,   // worldwide total revenue
    budget: data.budget || 0,
    genres: (data.genres || []).map(g => g.name),
    imdb_id: data.imdb_id || null,
  };
}

/**
 * Get external IDs (IMDB, etc.) for a TMDB movie.
 * @param {number} tmdbId
 * @returns {Promise<{imdb_id: string|null}>}
 */
export async function getExternalIds(tmdbId) {
  const { data } = await client().get(`/movie/${tmdbId}/external_ids`);
  return { imdb_id: data.imdb_id || null };
}
