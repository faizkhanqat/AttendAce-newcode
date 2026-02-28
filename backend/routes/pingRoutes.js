// backend/routes/pingRoutes.js
const express = require('express');
const router = express.Router();

// Super lightweight ping
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date() }); // just send 'ok'
});

module.exports = router;