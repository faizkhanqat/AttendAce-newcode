const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const studentController = require('../controllers/studentController');

// Auth middleware
router.use(authenticateToken, authorizeRole('student'));

router.get('/profile', studentController.getProfile);
router.put('/update', studentController.updateProfile);
router.get('/analytics', studentController.getAnalytics);

router.get('/classes', studentController.getAvailableClasses);
router.get('/classes/my', studentController.getMyClasses);
router.post('/classes/enroll', studentController.enrollInClass);
router.post('/classes/unenroll', studentController.unenrollFromClass);

module.exports = router;