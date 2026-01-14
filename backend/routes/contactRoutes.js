const express = require('express');
const router = express.Router();
const sendFeedback = require('../controllers/contactController'); // direct import
const authMiddleware = require('../middlewares/authMiddleware'); // direct import

// POST /api/contact/contact-developers
router.post('/contact-developers', authMiddleware, sendFeedback);

module.exports = router;