// backend/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const studentController = require('../controllers/studentController');

router.get('/profile', authenticateToken, authorizeRole('student'), studentController.getProfile);
router.get('/analytics', authenticateToken, authorizeRole('student'), studentController.getAnalytics);

// available classes (teacher classes not yet enrolled)
router.get('/classes', authenticateToken, authorizeRole('student'), studentController.getAvailableClasses);

// enroll / unenroll
router.post('/classes/enroll', authenticateToken, authorizeRole('student'), studentController.enrollInClass);
router.post('/classes/unenroll', authenticateToken, authorizeRole('student'), studentController.unenrollFromClass);

// get my enrolled classes
router.get('/classes/my', authenticateToken, authorizeRole('student'), studentController.getMyClasses);

module.exports = router;