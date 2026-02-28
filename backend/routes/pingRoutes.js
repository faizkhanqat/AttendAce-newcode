const express = require('express');
const router = express.Router();

// Lightweight ping endpoint
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

module.exports = router;