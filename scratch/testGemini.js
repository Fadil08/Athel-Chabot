const apiKey = 'AIzaSyAvGI_LWXN8LrorYeY7-shaahgpY5Ur5gg';
const model = 'gemini-2.5-flash';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

console.log(`🔗 Testing ${model}...`);

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Halo! Siapa kamu? Jawab dalam 1 kalimat saja.' }] }],
    systemInstruction: { parts: [{ text: 'Kamu adalah asisten AI bernama Chatagentive yang ramah dan helpful.' }] }
  })
})
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error('❌ API Error:', data.error.message);
  } else {
    const reply = data.candidates[0].content.parts[0].text;
    console.log('✅ Gemini 2.5 Flash AKTIF & berfungsi!');
    console.log('💬 Respons:', reply.trim());
  }
})
.catch(err => console.error('❌ Fetch Error:', err.message));
