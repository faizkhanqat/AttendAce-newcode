const pool = require('../config/db');

// Get student profile
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching student profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update student profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email)
      return res.status(400).json({ message: 'Name and email are required' });

    await pool.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone || null, req.user.id]
    );

    const [updated] = await pool.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'Profile updated successfully', user: updated[0] });
  } catch (err) {
    console.error('Error updating student profile:', err);
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

// Get available teacher classes
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
    const { class_id } = req.body;
    if (!class_id)
      return res.status(400).json({ message: 'class_id is required' });

    const [cls] = await pool.query('SELECT * FROM classes WHERE id = ?', [class_id]);
    if (cls.length === 0)
      return res.status(404).json({ message: 'Class not found' });

    const [existing] = await pool.query(
      'SELECT * FROM student_classes WHERE student_id = ? AND class_id = ?',
      [req.user.id, class_id]
    );
    if (existing.length > 0)
      return res.status(400).json({ message: 'Already enrolled' });

    await pool.query('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)', [req.user.id, class_id]);
    res.json({ message: 'Enrolled successfully' });
  } catch (err) {
    console.error('Error enrolling:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unenroll from class
exports.unenrollFromClass = async (req, res) => {
  try {
    const { class_id } = req.body;
    if (!class_id)
      return res.status(400).json({ message: 'class_id is required' });

    await pool.query('DELETE FROM student_classes WHERE student_id = ? AND class_id = ?', [req.user.id, class_id]);
    res.json({ message: 'Unenrolled successfully' });
  } catch (err) {
    console.error('Error unenrolling:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Analytics
exports.getAnalytics = async (req, res) => {
  try {
    const [attendance] = await pool.query(
      'SELECT class_id, COUNT(*) AS total_classes, SUM(status="present") AS attended FROM attendance WHERE student_id = ? GROUP BY class_id',
      [req.user.id]
    );
    res.json(attendance);
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ message: 'Server error' });
  }
};