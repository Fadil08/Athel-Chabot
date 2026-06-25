/**
 * AI Service to handle requests to external LLM APIs using global fetch.
 */
async function generateResponse(provider, apiKey, model, systemPrompt, userMessage, context = '') {
  let fullSystemPrompt = systemPrompt;
  if (context) {
    fullSystemPrompt += `\n\n=== CONTEXT DATA ===\n${context}\n====================\n`;
  }

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      return {
        responseText: data.choices[0].message.content,
        tokens: data.usage?.total_tokens || 0
      };

    } else if (provider === 'gemini') {
      // Gemini model API endpoint
      const targetModel = model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: userMessage }] }
          ],
          systemInstruction: {
            parts: [{ text: fullSystemPrompt }]
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      return {
        responseText: data.candidates[0].content.parts[0].text,
        tokens: data.usageMetadata?.totalTokenCount || 0
      };

    } else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20240620',
          system: fullSystemPrompt,
          messages: [
            { role: 'user', content: userMessage }
          ],
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      return {
        responseText: data.content[0].text,
        tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      };

    } else if (provider === 'ollama') {
      const baseUrl = apiKey || 'http://localhost:11434';
      const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'qwen3.5:0.8b',
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: userMessage }
          ],
          stream: false,
          options: {
            temperature: 0.7
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return {
        responseText: data.message.content,
        tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      };

    } else {
      throw new Error(`AI Provider '${provider}' tidak didukung`);
    }
  } catch (err) {
    console.error('API Error:', err.message);
    throw err;
  }
}

module.exports = {
  generateResponse
};
