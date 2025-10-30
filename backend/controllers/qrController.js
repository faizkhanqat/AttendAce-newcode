// backend/controllers/qrController.js
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

exports.generateQR = async (req, res) => {
  try {
    const { class_id, expires_in_minutes } = req.body;
    if (!class_id) return res.status(400).json({ message: 'class_id required' });

    // generate token and expiry
    const token = uuidv4();
    const expiresAt = moment().add(expires_in_minutes && Number(expires_in_minutes) > 0 ? Number(expires_in_minutes) : 15, 'minutes').format('YYYY-MM-DD HH:mm:ss');

    // Insert new qr token row
    await pool.query(
      'INSERT INTO qr_tokens (class_id, teacher_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [class_id, req.user.id, token, expiresAt]
    );

    return res.status(201).json({ token, expires_at: expiresAt });
  } catch (err) {
    console.error('Error generating QR token:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};