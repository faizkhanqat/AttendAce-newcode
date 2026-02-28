//backen/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const { getClassAttendanceCSV } = require('../controllers/attendanceController');
const { 
  markAttendance, 
  faceMarkAttendance, 
  getStudentAnalytics, 
  getTeacherAnalytics 
} = require('../controllers/attendanceController');
const attendanceController = require('../controllers/attendanceController');
const verifyToken = require('../middlewares/verifyToken');

// Mark attendance via QR
router.post('/mark', authenticateToken, authorizeRole('student'), markAttendance);

// Mark attendance via Face Recognition
router.post('/face-mark', authenticateToken, authorizeRole('student'), faceMarkAttendance);

// Student analytics
router.get('/analytics/student', authenticateToken, authorizeRole('student'), getStudentAnalytics);

// Teacher analytics
router.get('/analytics/teacher', authenticateToken, authorizeRole('teacher'), getTeacherAnalytics);

//csv
router.get('/analytics/class/:class_id/csv', authenticateToken, authorizeRole('teacher'), getClassAttendanceCSV);

router.get('/class/:id', verifyToken, attendanceController.getClassAttendancePreview);

module.exports = router;