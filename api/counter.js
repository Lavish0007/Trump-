export default async function handler(req, res) {
  try {
    const response = await fetch(
      'https://api.counterapi.dev/hit/trump-card-app/visits'
    );
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ value: data.value });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch counter' });
  }
}
