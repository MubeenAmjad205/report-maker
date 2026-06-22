const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    const response = await axios.get(`https://api.github.com/users/MubeenAmjad205/events`, {
      headers: {
        Authorization: `Bearer ${process.env.GH_PAT}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: { per_page: 100 }
    });
    
    const pushEvents = response.data.filter(e => e.type === 'PushEvent');
    console.log(`Found ${pushEvents.length} push events.`);
    const repos = new Set(pushEvents.map(e => e.repo.name));
    console.log('Repos involved:', Array.from(repos));
  } catch(e) {
    console.error(e.response?.data || e.message);
  }
}
test();
