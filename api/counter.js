module.exports = async (req, res) => {
  try {
    const response = await fetch(
      'https://api.countapi.xyz/hit/trump-selector/visits'
    );
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ value: data.value });
  } catch (error) {
    console.error('Counter API error:', error);
    res.status(500).json({ error: 'Failed to fetch counter' });
  }
};
