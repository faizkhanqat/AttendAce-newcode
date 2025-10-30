// backend/routes/teacherRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const { getClasses, addClass, generateQR } = require('../controllers/teacherController');

// Apply authentication + role middleware to all teacher routes
router.use(authenticateToken, authorizeRole('teacher'));

// Routes
router.get('/classes', getClasses);                // Fetch all classes
router.post('/classes/add', addClass);            // Add a new class
router.post('/classes/generate-qr', generateQR);  // Generate QR token for a class

module.exports = router;