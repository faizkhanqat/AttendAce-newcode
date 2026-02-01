//backend/controllers/studentController.js
const pool = require('../config/db');

// Get student profile
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, department, aviation_id FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Error fetching student profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update student profile
// Update student profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, department, gender, dob } = req.body;

    const fields = [];
    const values = [];

    if (name) {
      fields.push('name = ?');
      values.push(name);
    }

    if (email) {
      fields.push('email = ?');
      values.push(email);
    }

    if (department) {
      fields.push('department = ?');
      values.push(department);
    }

    if (gender) {
      fields.push('gender = ?');
      values.push(gender);
    }

    if (dob) {
      fields.push('dob = ?');
      values.push(dob);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    // ✅ Update user
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      [...values, req.user.id]
    );

    // ✅ FETCH UPDATED USER (THIS WAS MISSING)
    const [updated] = await pool.query(
      'SELECT id, name, email, role, gender, dob, department, aviation_id FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      message: 'Profile updated successfully',
      user: updated[0]
    });

  } catch (err) {
    console.error('Update error:', err);
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

// ------------------- FACE REGISTRATION -------------------

// Get face registration status
exports.getFaceStatus = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT face_encoding FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found' });

    res.json({ registered: !!rows[0].face_encoding });
  } catch (err) {
    console.error('Error fetching face status:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get face encoding for frontend
exports.getFaceEncoding = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT face_encoding FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found' });

    res.json({ face_encoding: rows[0].face_encoding || null });
  } catch (err) {
    console.error('Error fetching face encoding:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register or update face
exports.registerFace = async (req, res) => {
  try {
    const { face_encoding } = req.body;
    if (!face_encoding)
      return res.status(400).json({ message: 'face_encoding is required' });

    await pool.query(
      'UPDATE users SET face_encoding = ? WHERE id = ?',
      [face_encoding, req.user.id]
    );

    res.json({ message: 'Face registered/updated successfully' });
  } catch (err) {
    console.error('Error registering face:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ------------------- ACTIVE CLASS -------------------
// Get the active class (for face attendance)
exports.getActiveClass = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Only consider classes the student is enrolled in
    const [rows] = await pool.query(
      `SELECT ac.class_id, ac.expires_at
       FROM active_classes ac
       JOIN student_classes sc ON ac.class_id = sc.class_id
       WHERE sc.student_id = ? AND ac.expires_at >= NOW()
       ORDER BY ac.expires_at DESC
       LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'No active class' });

    res.json({
      class_id: rows[0].class_id,
      expires_at: rows[0].expires_at
    });
  } catch (err) {
    console.error('Error fetching active class:', err);
    res.status(500).json({ message: 'Server error' });
  }
};