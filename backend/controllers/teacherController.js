//backend/controllers/teacherController.js
const db = require('../config/db');

// Get teacher profile
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, phone, role FROM users WHERE id = ?', [req.user.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update teacher profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email)
      return res.status(400).json({ message: 'Name and email required' });

    await db.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone || null, req.user.id]
    );

    const [updated] = await db.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'Profile updated successfully', user: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get classes
exports.getClasses = async (req, res) => {
  try {
    const [classes] = await db.query('SELECT * FROM classes WHERE teacher_id = ?', [req.user.id]);
    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add new class
exports.addClass = async (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name) return res.status(400).json({ message: 'Class name required' });

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

// Generate QR
exports.generateQR = async (req, res) => {
  try {
    const { class_id, token, duration } = req.body;
    if (!class_id || !token)
      return res.status(400).json({ message: 'Missing data' });

    const qrDuration = duration || 15;
    await db.query(
      'INSERT INTO qr_tokens (class_id, token, duration, created_at) VALUES (?, ?, ?, NOW())',
      [class_id, token, qrDuration]
    );

    res.status(201).json({ message: 'QR registered', token, class_id, duration: qrDuration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};