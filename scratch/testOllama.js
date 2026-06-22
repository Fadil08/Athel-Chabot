const targetUrl = 'http://103.92.209.106:11434/api/tags';
console.log('Fetching Ollama tags from:', targetUrl);

fetch(targetUrl)
  .then(res => {
    console.log('Response status:', res.status);
    return res.json();
  })
  .then(data => {
    console.log('Ollama available models:', data);
  })
  .catch(err => {
    console.error('Failed to connect to Ollama:', err.message);
  });
