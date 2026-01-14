const express = require('express');
const router = express.Router();
const { sendFeedback } = require('../controllers/contactController');
const { authMiddleware } = require('../middlewares/authMiddleware'); // only logged in users can send

router.post('/contact-developers', authMiddleware, sendFeedback);

module.exports = router;