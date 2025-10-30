// backend/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const { markAttendance } = require('../controllers/attendanceController');

router.post('/mark', authenticateToken, authorizeRole('student'), markAttendance);

module.exports = router;