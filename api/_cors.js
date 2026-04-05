function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://kibeproxy-hub.vercel.app',
    'http://localhost:5501',
    'http://127.0.0.1:5501'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Fallback for production or other origins
    res.setHeader('Access-Control-Allow-Origin', 'https://kibeproxy-hub.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = { setCorsHeaders };
