/**
 * OMDb API service — fetch movie data by IMDB ID.
 *
 * Returns IMDB rating, Rotten Tomatoes score, and domestic box office.
 * Docs: https://www.omdbapi.com/
 */
import axios from 'axios';

const OMDB_BASE = 'https://www.omdbapi.com/';

function getKey() {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new Error('OMDB_API_KEY not configured in .env');
  return key;
}

/**
 * Parse a dollar string like "$319,494,308" into a number.
 * Returns null if the value is "N/A" or unparseable.
 */
function parseDollar(str) {
  if (!str || str === 'N/A') return null;
  const num = Number(str.replace(/[$,]/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * Parse the RT score from OMDb's Ratings array.
 * OMDb returns it as "91%" — we store it as a number (91).
 */
function parseRtScore(ratings) {
  if (!Array.isArray(ratings)) return null;
  const rt = ratings.find(r => r.Source === 'Rotten Tomatoes');
  if (!rt) return null;
  const num = parseInt(rt.Value, 10);
  return isNaN(num) ? null : num;
}

/**
 * Fetch movie details from OMDb by IMDB ID.
 * @param {string} imdbId — e.g. "tt1160419"
 * @returns {Promise<Object>} — parsed stats
 */
export async function getMovieByImdbId(imdbId) {
  const { data } = await axios.get(OMDB_BASE, {
    params: { apikey: getKey(), i: imdbId, plot: 'short' },
    timeout: 8000,
  });

  if (data.Response === 'False') {
    throw new Error(`OMDb error: ${data.Error}`);
  }

  return {
    title: data.Title,
    year: data.Year,
    rated: data.Rated,
    released: data.Released,
    runtime: data.Runtime,
    genre: data.Genre,
    director: data.Director,
    plot: data.Plot,
    poster: data.Poster !== 'N/A' ? data.Poster : null,

    // Stats we care about for the league
    imdb_rating: data.imdbRating && data.imdbRating !== 'N/A'
      ? parseFloat(data.imdbRating) : null,
    rt_score: parseRtScore(data.Ratings),
    domestic_box_office: parseDollar(data.BoxOffice),

    // Raw data for debugging
    _raw: data,
  };
}

/**
 * Build a complete stats object for a movie, combining OMDb + TMDB data.
 *
 * - domestic_box_office: from OMDb `BoxOffice` field
 * - international_box_office: TMDB worldwide revenue − OMDb domestic
 * - domestic_opening_weekend: not available from either API (leave null)
 * - imdb_rating: from OMDb
 * - rt_score: from OMDb Ratings array
 *
 * @param {Object} omdbData — from getMovieByImdbId()
 * @param {Object} tmdbData — from tmdb.getMovieDetails()
 * @returns {Object} stats ready for movie_stats table
 */
export function buildStats(omdbData, tmdbData) {
  const domestic = omdbData.domestic_box_office;
  const worldwide = tmdbData?.revenue || 0;

  // International = worldwide − domestic (only if both are available)
  let international = null;
  if (domestic != null && worldwide > 0 && worldwide > domestic) {
    international = worldwide - domestic;
  }

  return {
    domestic_box_office: domestic,
    international_box_office: international,
    domestic_opening_weekend: null, // not available from OMDb/TMDB — manual entry or future scraping
    imdb_rating: omdbData.imdb_rating,
    rt_score: omdbData.rt_score,
    letterboxd_avg_score: null,      // skip for now
    letterboxd_members_rated: null,  // skip for now
  };
}
