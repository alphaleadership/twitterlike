const TWITTER_EPOCH = 1288834974657n;

/**
 * Extrait la date exacte de création d'un tweet à partir de son identifiant Snowflake Twitter (ID >= fin 2010).
 * @param {string|number|BigInt} tweetId 
 * @returns {Date|null}
 */
function getSnowflakeDate(tweetId) {
  if (!tweetId) return null;
  try {
    const id = BigInt(String(tweetId).trim());
    // Les identifiants Snowflake Twitter ont démarré fin 2010 avec un id > 30000000000
    if (id <= 30000000000n) return null;
    const timestampMs = Number((id >> 22n) + TWITTER_EPOCH);
    const d = new Date(timestampMs);
    if (isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    if (year < 2010 || year > 2035) return null;
    return d;
  } catch (_) {
    return null;
  }
}

/**
 * Récupère ou reconstruit une date valide pour un tweet donné.
 * @param {Object} tweet 
 * @returns {Date}
 */
function resolveTweetDate(tweet) {
  if (!tweet) return new Date();

  // 1. Si une date valide existe déjà
  if (tweet.date && tweet.date !== 'Invalid Date') {
    const parsed = new Date(tweet.date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // 2. Tenter d'extraire depuis tweet.id ou l'URL tweet.lien
  let id = tweet.id;
  if (!id && tweet.lien) {
    const match = String(tweet.lien).match(/status\/(\d+)/);
    if (match) id = match[1];
  }

  const snowflakeDate = getSnowflakeDate(id);
  if (snowflakeDate) {
    return snowflakeDate;
  }

  return new Date();
}

/**
 * Formate de manière sécurisée une date de tweet en évitant tout "Invalid Date".
 * @param {string|Date} date 
 * @param {string|number} tweetId
 * @param {string} locale
 * @returns {string}
 */
function formatTweetDate(date, tweetId = null, locale = 'fr-FR') {
  let d = null;
  if (date && date !== 'Invalid Date') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  if (!d && tweetId) {
    d = getSnowflakeDate(tweetId);
  }

  if (!d) return '';

  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

module.exports = {
  getSnowflakeDate,
  resolveTweetDate,
  formatTweetDate
};
