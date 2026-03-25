const { setCorsHeaders } = require('./_cors');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};
