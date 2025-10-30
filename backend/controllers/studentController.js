// backend/controllers/studentController.js
const pool = require('../config/db');

// Get student profile (existing)
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching student profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get classes the student is enrolled in
exports.getMyClasses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, u.name AS teacher_name, c.teacher_id
       FROM student_classes sc
       JOIN classes c ON sc.class_id = c.id
       JOIN users u ON c.teacher_id = u.id
       WHERE sc.student_id = ?`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching my classes:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get available teacher classes (exclude already enrolled)
exports.getAvailableClasses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, u.name AS teacher_name, c.teacher_id
       FROM classes c
       JOIN users u ON c.teacher_id = u.id
       WHERE c.id NOT IN (SELECT class_id FROM student_classes WHERE student_id = ?)`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching available classes:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Enroll in a class
exports.enrollInClass = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { class_id } = req.body;
    if (!class_id) return res.status(400).json({ message: 'class_id is required' });

    // verify class exists
    const [cls] = await pool.query('SELECT * FROM classes WHERE id = ?', [class_id]);
    if (!cls || cls.length === 0) return res.status(404).json({ message: 'Class not found' });

    // check already enrolled
    const [existing] = await pool.query('SELECT * FROM student_classes WHERE student_id = ? AND class_id = ?', [studentId, class_id]);
    if (existing && existing.length > 0) return res.status(400).json({ message: 'Already enrolled' });

    await pool.query('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)', [studentId, class_id]);
    return res.json({ message: 'Enrolled successfully', class_id });
  } catch (err) {
    console.error('Error enrolling:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unenroll from a class
exports.unenrollFromClass = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { class_id } = req.body;
    if (!class_id) return res.status(400).json({ message: 'class_id is required' });

    await pool.query('DELETE FROM student_classes WHERE student_id = ? AND class_id = ?', [studentId, class_id]);
    return res.json({ message: 'Unenrolled successfully', class_id });
  } catch (err) {
    console.error('Error unenrolling:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Existing analytics (unchanged)
exports.getAnalytics = async (req, res) => {
  try {
    const [attendance] = await pool.query(
      'SELECT class_id, COUNT(*) AS total_classes, SUM(status="present") AS attended FROM attendance WHERE student_id = ? GROUP BY class_id',
      [req.user.id]
    );
    res.json(attendance);
  } catch (err) {
    console.error('Error fetching student analytics:', err);
    res.status(500).json({ message: 'Server error' });
  }
};