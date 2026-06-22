const pdfParse = require('pdf-parse');

/**
 * Extracts text page-by-page from a PDF buffer.
 */
async function extractPages(buffer) {
  let result;

  if (typeof pdfParse === 'function') {
    result = await pdfParse(buffer);
  } else if (pdfParse && typeof pdfParse.PDFParse === 'function') {
    const parser = new pdfParse.PDFParse({ data: buffer });
    await parser.load();
    result = await parser.getText();
    if (typeof result === 'string') {
      result = { text: result };
    }
  } else {
    throw new Error('Unsupported pdf-parse API shape');
  }

  const text = result.text || '';

  if (Array.isArray(result.pages) && result.pages.length > 0) {
    return result.pages.map((page, index) => ({
      pageNumber: page.num || index + 1,
      text: page.text || ''
    }));
  }

  const pages = text.split(/\f+/).filter(pageText => pageText.trim().length > 0);
  return pages.map((pageText, index) => ({
    pageNumber: index + 1,
    text: pageText.trim()
  }));
}

/**
 * Splits page text into smaller chunks (excerpts) for more accurate similarity matching.
 */
function chunkText(text, maxWords = 100) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += maxWords) {
    const chunkWords = words.slice(i, i + maxWords);
    chunks.push(chunkWords.join(' '));
  }

  return chunks;
}

/**
 * Processes PDF buffer and creates knowledge base excerpts.
 */
async function processPdf(buffer, filename, documentId) {
  const pages = await extractPages(buffer);
  const excerpts = [];

  for (const page of pages) {
    const chunks = chunkText(page.text, 80);
    chunks.forEach(chunk => {
      if (chunk.trim().length > 10) {
        excerpts.push({
          documentId,
          content: chunk,
          pageNumber: page.pageNumber,
          filename
        });
      }
    });
  }

  return excerpts;
}

/**
 * Auto-generate Intents from PDF content
 * Analyzes text structure for common Q&A patterns or headings.
 */
function autoGenerateIntents(excerpts) {
  const generatedIntents = [];

  excerpts.forEach((excerpt, index) => {
    const text = excerpt.content;
    const questionMatch = text.match(/([^.!?\n]+\?)/g);
    if (questionMatch) {
      questionMatch.forEach(q => {
        const cleanQ = q.trim();
        if (cleanQ.length > 10 && cleanQ.length < 150) {
          const keywords = cleanQ
            .replace(/\?/g, '')
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 3)
            .slice(0, 5);

          if (keywords.length > 0) {
            generatedIntents.push({
              id: Date.now() + index,
              keywords: [keywords.join(' '), cleanQ],
              response: text,
              category: 'Auto-Generated',
              sourceRef: {
                filename: excerpt.filename,
                pageNumber: excerpt.pageNumber
              }
            });
          }
        }
      });
    }
  });

  return generatedIntents.slice(0, 10);
}

module.exports = {
  extractPages,
  processPdf,
  autoGenerateIntents
};
