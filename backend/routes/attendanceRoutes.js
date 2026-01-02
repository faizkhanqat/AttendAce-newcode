const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const { markAttendance, getAnalytics } = require('../controllers/attendanceController');

// Mark attendance via QR
router.post('/mark', authenticateToken, authorizeRole('student'), markAttendance);

// Get attendance analytics
router.get('/analytics', authenticateToken, authorizeRole('student'), getAnalytics);

module.exports = router;