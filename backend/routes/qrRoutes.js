// backend/routes/qrRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const { generateQR } = require('../controllers/qrController');

router.post('/generate', authenticateToken, authorizeRole('teacher'), generateQR);

module.exports = router;