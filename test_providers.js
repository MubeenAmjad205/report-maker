const axios = require('axios');

async function testOpenRouter() {
    try {
        await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'google/gemini-flash-1.5',
                messages: [{ role: 'user', content: 'test' }],
            },
            {
                headers: {
                    // Intentionally missing or malformed to see error
                    Authorization: 'Bearer ',
                },
            }
        );
    } catch (e) {
        console.log('OpenRouter:', e.response?.data);
    }
}

async function testGemini() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=`;
        await axios.post(url, {
            contents: [{ parts: [{ text: 'test' }] }],
        });
    } catch (e) {
        console.log('Gemini:', JSON.stringify(e.response?.data));
    }
}

async function run() {
    await testOpenRouter();
    await testGemini();
}
run();
