const axios = require('axios');

async function testOpenRouterInvalid() {
    try {
        await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'google/gemini-flash-1.5',
                messages: [{ role: 'user', content: 'test' }],
            },
            {
                headers: {
                    Authorization: 'Bearer invalid_key_here',
                },
            }
        );
    } catch (e) {
        console.log('OpenRouter Invalid Key:', e.response?.data);
    }
}
testOpenRouterInvalid();
