const apiKey = 'AIzaSyAvGI_LWXN8LrorYeY7-shaahgpY5Ur5gg';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log('📋 Mencari model Gemini yang tersedia...\n');

fetch(url)
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error('❌ Error:', data.error.message);
    return;
  }
  const chatModels = data.models
    .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => ({ name: m.name, displayName: m.displayName }));
  
  console.log(`✅ Ditemukan ${chatModels.length} model yang mendukung generateContent:\n`);
  chatModels.forEach(m => console.log(`  - ${m.name.replace('models/', '')} → ${m.displayName}`));
})
.catch(err => console.error('❌ Fetch Error:', err.message));
