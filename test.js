const axios = require('axios');

async function test() {
  const username = 'MubeenAmjad205';
  const today = new Date().toISOString().split('T')[0];
  const query = `author:${username} committer-date:>=${today}`;
  console.log('Query:', query);

  try {
    const response = await axios.get(`https://api.github.com/search/commits`, {
      params: { q: query, per_page: 10, sort: 'author-date', order: 'desc' },
      headers: { Accept: 'application/vnd.github.v3+json' }
    });
    
    console.log(`Found ${response.data.items.length} commits.`);
    for (const item of response.data.items) {
        console.log(`Repo: ${item.repository.full_name} - ${item.commit.message}`);
    }
  } catch (error) {
    console.error(error.response?.data || error.message);
  }
}

test();
