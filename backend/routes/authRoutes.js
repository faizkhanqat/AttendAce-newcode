const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ------------------ REGISTER & LOGIN ------------------
router.post('/register', authController.register);
router.post('/login', authController.login);

// ------------------ FORGOT PASSWORD / OTP ------------------
// Step 1: Request OTP
router.post('/forgot-password', authController.requestOtp);

// Step 2: Verify OTP
router.post('/verify-otp', authController.verifyOtp);

// Step 3: Reset password
router.post('/reset-password', authController.resetPassword);

module.exports = router;