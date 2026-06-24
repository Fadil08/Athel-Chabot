const natural = require('natural');
const nlpProcessor = require('./nlpProcessor');
const dbManager = require('./db');
const aiService = require('./aiService');

/**
 * Calculates similarity between user tokens and comparison tokens.
 * If isKeyword is true, matches relative to the comparison token length (meaning if keyword is fully inside user input, it's 100% match).
 */
function calculateTokenSimilarity(userTokens, targetTokens, isKeyword = false, nlpEnabled = true) {
  if (userTokens.length === 0 || targetTokens.length === 0) return 0;
  
  let totalScore = 0;
  const matchedIndices = new Set();
  
  for (const t1 of userTokens) {
    let bestTokenScore = 0;
    let bestIdx = -1;
    
    for (let i = 0; i < targetTokens.length; i++) {
      if (matchedIndices.has(i)) continue;
      const t2 = targetTokens[i];
      
      let similarity = 0;
      if (nlpEnabled) {
        const lev = natural.LevenshteinDistance(t1, t2);
        const maxLen = Math.max(t1.length, t2.length);
        similarity = maxLen === 0 ? 1 : 1 - (lev / maxLen);
      } else {
        similarity = (t1 === t2) ? 1 : 0;
      }
      
      if (similarity > bestTokenScore) {
        bestTokenScore = similarity;
        bestIdx = i;
      }
    }
    
    if (bestTokenScore > 0.6) {
      totalScore += bestTokenScore;
      if (bestIdx !== -1) matchedIndices.add(bestIdx);
    }
  }
  
  // If it's a keyword intent matching, check how much of the target keyword is matched.
  if (isKeyword) {
    return totalScore / targetTokens.length;
  }
  
  // For RAG matching where user query is shorter than the target document paragraph,
  // check how much of the user's query is found in the target document.
  if (targetTokens.length > userTokens.length) {
    return totalScore / userTokens.length;
  }
  
  // For other scenarios (e.g. mutual comparison), check mutual overlap
  return totalScore / Math.max(userTokens.length, targetTokens.length);
}

/**
 * Find Answer (Hybrid Local NLP + RAG AI Fallback)
 */
async function findAnswer(chatbotId, userMessage) {
  const chatbot = await dbManager.getChatbotById(chatbotId);
  if (!chatbot) {
    return { found: false, response: 'Chatbot tidak ditemukan' };
  }

  // Load configs
  const nlpConfig = chatbot.nlp || {
    similarityThreshold: 0.6,
    stemmingEnabled: true,
    stopWordsEnabled: true,
    language: 'id'
  };
  const branding = chatbot.branding || {
    fallbackMessage: 'Maaf, saya belum mengerti pertanyaan Anda.',
    greetingMessage: 'Halo!'
  };

  const threshold = nlpConfig.similarityThreshold || 0.6;
  const isNlpEnabled = nlpConfig.nlpEnabled !== false;
  const defaultFallback = branding.fallbackMessage;

  // Preprocess user input
  const userTokens = nlpProcessor.preprocess(userMessage, nlpConfig);

  // 1. Search Manual Intents
  const intents = await dbManager.getIntents(chatbotId);
  let bestIntent = null;
  let bestIntentScore = 0;

  for (const intent of intents) {
    for (const rawKeyword of intent.keywords) {
      const keywordTokens = nlpProcessor.preprocess(rawKeyword, nlpConfig);
      // isKeyword = true
      const score = calculateTokenSimilarity(userTokens, keywordTokens, true, isNlpEnabled);
      
      if (score > bestIntentScore) {
        bestIntentScore = score;
        bestIntent = intent;
      }
    }
  }

  // If found intent match above threshold, return it immediately
  if (bestIntent && bestIntentScore >= threshold) {
    return {
      found: true,
      source: 'intent',
      response: bestIntent.response,
      category: bestIntent.category,
      score: bestIntentScore
    };
  }

  // 2. Fetch excerpts from Knowledge Base for RAG context or local matching
  const kb = await dbManager.getKnowledgeBase(chatbotId);
  
  // Sort and match excerpts
  const scoredExcerpts = kb.map(excerpt => {
    const excerptTokens = nlpProcessor.preprocess(excerpt.content, nlpConfig);
    const score = calculateTokenSimilarity(userTokens, excerptTokens, false, isNlpEnabled);
    return { excerpt, score };
  })
  .filter(item => item.score > 0.15) // soft threshold for retrieval
  .sort((a, b) => b.score - a.score);

  // If AI is enabled, call LLM with retrieved context (RAG)
  if (chatbot.aiEnabled && (chatbot.aiApiKey || chatbot.aiProvider === 'ollama') && chatbot.aiProvider) {
    // Compile top 3 excerpts as context
    const topExcerpts = scoredExcerpts.slice(0, 3).map(item => 
      `[Document: ${item.excerpt.filename}, Page: ${item.excerpt.pageNumber}]: ${item.excerpt.content}`
    ).join('\n\n');

    try {
      const fallbackMsg = branding.fallbackMessage || 'Maaf, saya belum mengerti pertanyaan Anda.';
      let systemPrompt = chatbot.aiSystemPrompt || 'Anda adalah asisten AI yang cerdas.';
      systemPrompt += `\n\nJika informasi tidak ditemukan di data konteks yang disediakan, Anda harus membalas dengan pesan berikut secara persis: "${fallbackMsg}"`;

      const aiResult = await aiService.generateResponse(
        chatbot.aiProvider,
        chatbot.aiApiKey,
        chatbot.aiModel,
        systemPrompt,
        userMessage,
        topExcerpts
      );

      const aiResponse = aiResult.responseText;
      const tokensUsed = aiResult.tokens || 0;

      // Update token usage in database
      if (tokensUsed > 0) {
        try {
          const currentUsage = chatbot.tokenUsage || 0;
          await dbManager.updateChatbot(chatbotId, { tokenUsage: currentUsage + tokensUsed });
          console.log(`Updated token usage for chatbot ${chatbotId}: +${tokensUsed} tokens`);
        } catch (dbErr) {
          console.error('Failed to update chatbot token usage in DB:', dbErr);
        }
      }

      // If we used context, we can append a citation note
      let citation = null;
      if (scoredExcerpts.length > 0) {
        citation = {
          filename: scoredExcerpts[0].excerpt.filename,
          pageNumber: scoredExcerpts[0].excerpt.pageNumber
        };
      }

      // Save Q&A to database if it's not a fallback message to be used by NLP later
      if (aiResponse && aiResponse.trim().toLowerCase() !== fallbackMsg.trim().toLowerCase()) {
        try {
          const existingIntents = await dbManager.getIntents(chatbotId);
          const cleanedMessage = userMessage.trim().toLowerCase();
          const exists = existingIntents.some(intent => 
            intent.keywords.some(k => k.toLowerCase() === cleanedMessage)
          );

          if (!exists) {
            const topDocId = (scoredExcerpts.length > 0) ? scoredExcerpts[0].excerpt.documentId : null;
            await dbManager.addIntent(chatbotId, {
              keywords: [userMessage.trim()],
              response: aiResponse.trim(),
              category: 'AI-Learned',
              documentId: topDocId
            });
            console.log(`Saved AI response as 'AI-Learned' intent for chatbot ${chatbotId} linked to doc ${topDocId}`);
          }
        } catch (saveErr) {
          console.error('Failed to save AI response to database as learned intent:', saveErr);
        }
      }

      return {
        found: true,
        source: 'ai_llm',
        response: aiResponse,
        filename: citation ? citation.filename : null,
        pageNumber: citation ? citation.pageNumber : null
      };
    } catch (aiErr) {
      console.error('Failed to query AI Model, falling back to local KB or fallback:', aiErr.message);
    }
  }

  // 3. Fallback to Local Knowledge Base if AI is disabled/failed
  if (scoredExcerpts.length > 0 && scoredExcerpts[0].score >= threshold) {
    const bestExcerpt = scoredExcerpts[0].excerpt;
    return {
      found: true,
      source: 'knowledge_base',
      response: bestExcerpt.content,
      filename: bestExcerpt.filename,
      pageNumber: bestExcerpt.pageNumber,
      score: scoredExcerpts[0].score
    };
  }

  // 4. Fallback message
  return {
    found: false,
    response: defaultFallback,
    score: Math.max(bestIntentScore, scoredExcerpts[0] ? scoredExcerpts[0].score : 0)
  };
}

module.exports = {
  calculateTokenSimilarity,
  findAnswer
};
