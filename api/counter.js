module.exports = async (req, res) => {
  try {
    // Using Upstash Redis REST API
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      // Fallback if env vars not set
      return res.status(500).json({ error: 'Redis not configured' });
    }

    // Increment the counter
    const response = await fetch(`${upstashUrl}/incr/visitor-count`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashToken}`,
      },
    });

    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ value: data.result });
  } catch (error) {
    console.error('Counter API error:', error);
    res.status(500).json({ error: 'Failed to fetch counter', details: error.message });
  }
};
