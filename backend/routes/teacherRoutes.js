const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRole = require('../middlewares/roleMiddleware');
const teacherController = require('../controllers/teacherController');

// Auth middleware
router.use(authenticateToken, authorizeRole('teacher'));

router.get('/profile', teacherController.getProfile);
router.put('/update', teacherController.updateProfile);

router.get('/classes', teacherController.getClasses);
router.post('/classes/add', teacherController.addClass);

// QR (UNCHANGED)
router.post('/classes/generate-qr', teacherController.generateQR);

// ===============================
// NEW: Class activation (Face)
// ===============================
router.post('/classes/activate', teacherController.activateClass);
router.post('/classes/deactivate', teacherController.deactivateClass);

module.exports = router;