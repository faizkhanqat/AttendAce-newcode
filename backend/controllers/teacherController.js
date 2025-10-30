// backend/controllers/teacherController.js
const db = require('../config/db');

// Get teacher profile
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all classes for teacher
exports.getClasses = async (req, res) => {
  try {
    const [classes] = await db.query(
      'SELECT * FROM classes WHERE teacher_id = ?',
      [req.user.id]
    );
    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a new class
exports.addClass = async (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name) return res.status(400).json({ message: 'Class name is required' });

    const [result] = await db.query(
      'INSERT INTO classes (name, subject, teacher_id) VALUES (?, ?, ?)',
      [name, subject || '', req.user.id]
    );

    res.status(201).json({ id: result.insertId, name, subject: subject || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate QR token for a class
exports.generateQR = async (req, res) => {
  try {
    const { class_id, token, duration } = req.body;

    if (!class_id || !token) {
      return res.status(400).json({ message: 'Missing class_id or token' });
    }

    const qrDuration = duration || 15; // default 15 minutes

    await db.query(
      'INSERT INTO qr_tokens (class_id, token, duration, created_at) VALUES (?, ?, ?, NOW())',
      [class_id, token, qrDuration]
    );

    res.status(201).json({
      message: 'QR registered successfully',
      token,
      class_id,
      duration: qrDuration
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};