const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const { markAttendance, getStudentAnalytics, getTeacherAnalytics } = require('../controllers/attendanceController');

// Mark attendance via QR
router.post('/mark', authenticateToken, authorizeRole('student'), markAttendance);

// Student analytics
router.get('/analytics/student', authenticateToken, authorizeRole('student'), getStudentAnalytics);

// Teacher analytics
router.get('/analytics/teacher', authenticateToken, authorizeRole('teacher'), getTeacherAnalytics);

module.exports = router;