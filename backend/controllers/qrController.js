// backend/controllers/qrController.js
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

/**
 * Generate a new QR token that expires in 10 seconds
 * Each request gives a new token linked to a class
 */
exports.generateDynamicQR = async (req, res) => {
  try {
    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ message: 'class_id required' });

    const token = uuidv4();
    const expiresAt = moment().add(10, 'seconds').format('YYYY-MM-DD HH:mm:ss');

    await pool.query(
      'INSERT INTO qr_tokens (class_id, teacher_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [class_id, req.user.id, token, expiresAt]
    );

    return res.json({ token, expires_at: expiresAt });
  } catch (err) {
    console.error('Error generating dynamic QR:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Verify if a scanned QR token is valid (not expired)
 */
exports.verifyQR = async (req, res) => {
  try {
    const { token, class_id } = req.body;
    if (!token || !class_id)
      return res.status(400).json({ message: 'token and class_id required' });

    const [rows] = await pool.query(
      'SELECT * FROM qr_tokens WHERE token = ? AND class_id = ? ORDER BY created_at DESC LIMIT 1',
      [token, class_id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Invalid token' });

    const qr = rows[0];
    const now = moment();
    if (moment(qr.expires_at).isBefore(now))
      return res.status(400).json({ message: 'QR expired' });

    return res.json({ valid: true, class_id: qr.class_id });
  } catch (err) {
    console.error('Error verifying QR:', err);
    res.status(500).json({ message: 'Server error' });
  }
};