// backend/routes/qrRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const { generateDynamicQR, verifyQR } = require('../controllers/qrController');

// Teacher generates rotating dynamic QR
router.get('/dynamic', authenticateToken, authorizeRole('teacher'), generateDynamicQR);

// Student verifies scanned QR
router.post('/verify', authenticateToken, authorizeRole('student'), verifyQR);

module.exports = router;