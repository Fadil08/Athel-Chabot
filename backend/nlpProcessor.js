const natural = require('natural');

// List of Indonesian stop words
const INDONESIAN_STOP_WORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'adalah', 'itu', 'ini', 
  'dengan', 'saya', 'kamu', 'anda', 'dia', 'mereka', 'kita', 'kami', 'akan', 
  'telah', 'sudah', 'bisa', 'dapat', 'ada', 'tidak', 'bukan', 'hanya', 'saja', 
  'juga', 'oleh', 'atau', 'sebagai', 'seperti', 'jika', 'kalau', 'namun', 
  'tetapi', 'karena', 'sehingga', 'maka', 'tentang', 'apakah', 'bagaimana',
  'mengapa', 'kapan', 'siapa', 'berapa', 'mana', 'nih', 'sih', 'dong', 'kok',
  'lah', 'kah'
]);

// List of English stop words
const ENGLISH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'to', 'from', 
  'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'of', 
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 
  'having', 'do', 'does', 'did', 'doing', 'i', 'you', 'he', 'she', 'it', 
  'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what',
  'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'been'
]);

/**
 * Text Normalization
 * Converts to lowercase, removes punctuation, trims, and normalizes consecutive spaces.
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'\+\|\[\]]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ')                                    // normalize spaces
    .trim();
}

/**
 * Tokenization
 * Splits text into tokens by whitespace.
 */
function tokenizeText(text) {
  if (!text) return [];
  return text.split(' ').filter(token => token.length > 0);
}

/**
 * Remove Stop Words
 */
function removeStopWords(tokens, language = 'id') {
  const stopWords = language === 'en' ? ENGLISH_STOP_WORDS : INDONESIAN_STOP_WORDS;
  return tokens.filter(token => !stopWords.has(token));
}

/**
 * Stemming
 */
function stemTokens(tokens, language = 'id') {
  let stemmer;
  if (language === 'id') {
    // Check if natural.StemmerId is available
    if (natural.StemmerId) {
      stemmer = natural.StemmerId;
    } else {
      // Fallback simple Indonesian stemmer (removes common affixes if natural is not loaded correctly)
      return tokens.map(token => {
        return token
          .replace(/^(meng|peng|meny|peny|men|pen|me|pe)/, '')
          .replace(/(kan|an|i)$/, '');
      });
    }
  } else {
    stemmer = natural.PorterStemmer;
  }

  return tokens.map(token => {
    try {
      return stemmer.stem(token);
    } catch (e) {
      return token;
    }
  });
}

/**
 * Full Pipeline Preprocessing
 */
function preprocess(text, config = {}) {
  const isNlpEnabled = config.nlpEnabled !== false;
  const lang = config.language || 'id';
  const enableStopWords = isNlpEnabled && config.stopWordsEnabled !== false;
  const enableStemming = isNlpEnabled && config.stemmingEnabled !== false;

  let processed = normalizeText(text);
  let tokens = tokenizeText(processed);

  if (enableStopWords) {
    tokens = removeStopWords(tokens, lang);
  }

  if (enableStemming) {
    tokens = stemTokens(tokens, lang);
  }

  return tokens;
}

module.exports = {
  normalizeText,
  tokenizeText,
  removeStopWords,
  stemTokens,
  preprocess
};
