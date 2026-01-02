const pool = require('../config/db');

/**
 * Mark attendance for a student using a QR token
 */
exports.markAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { class_id, token } = req.body;

    if (!class_id || !token)
      return res.status(400).json({ message: 'class_id and token are required' });

    // Check QR validity
    const [qrRows] = await pool.query(
      'SELECT * FROM qr_tokens WHERE class_id = ? AND token = ? AND expires_at >= NOW() LIMIT 1',
      [class_id, token]
    );
    if (qrRows.length === 0)
      return res.status(400).json({ message: 'Invalid or expired QR' });

    // Check enrollment
    const [enrollRows] = await pool.query(
      'SELECT * FROM student_classes WHERE student_id = ? AND class_id = ?',
      [studentId, class_id]
    );
    if (enrollRows.length === 0)
      return res.status(403).json({ message: 'Not enrolled in this class' });

    // Prevent duplicate attendance same day
    const [existing] = await pool.query(
      'SELECT * FROM attendance WHERE student_id = ? AND class_id = ? AND DATE(timestamp) = CURDATE()',
      [studentId, class_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ message: 'Attendance already marked today' });

    // Mark attendance
    await pool.query(
      'INSERT INTO attendance (student_id, class_id, status, qr_token, timestamp) VALUES (?, ?, ?, ?, NOW())',
      [studentId, class_id, 'present', token]
    );

    return res.json({ message: 'Attendance marked successfully', class_id });
  } catch (err) {
    console.error('❌ Error in markAttendance:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get attendance analytics for the logged-in student
 */
exports.getAnalytics = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Fetch classes the student is enrolled in
    const [classes] = await pool.query(
      'SELECT c.id, c.name FROM classes c JOIN student_classes sc ON c.id = sc.class_id WHERE sc.student_id = ?',
      [studentId]
    );

    const analytics = [];

    for (const cls of classes) {
      // Total classes held
      const [totalRows] = await pool.query(
        'SELECT COUNT(*) AS total_days FROM attendance WHERE class_id = ?',
        [cls.id]
      );

      // Classes student was present
      const [presentRows] = await pool.query(
        'SELECT COUNT(*) AS present_days FROM attendance WHERE class_id = ? AND student_id = ?',
        [cls.id, studentId]
      );

      analytics.push({
        id: cls.id,
        name: cls.name,
        total_days: totalRows[0].total_days,
        present_days: presentRows[0].present_days,
      });
    }

    return res.json({ classes: analytics });
  } catch (err) {
    console.error('❌ Error fetching analytics:', err);
    res.status(500).json({ message: 'Server error' });
  }
};