// backend/controllers/attendanceController.js
const pool = require('../config/db');

exports.markAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { class_id, token } = req.body;

    if (!class_id || !token)
      return res.status(400).json({ message: 'class_id and token are required' });

    // ✅ check QR validity (not expired)
    const [qrRows] = await pool.query(
      'SELECT * FROM qr_tokens WHERE class_id = ? AND token = ? AND expires_at >= NOW() LIMIT 1',
      [class_id, token]
    );
    if (qrRows.length === 0)
      return res.status(400).json({ message: 'Invalid or expired QR' });

    // ✅ check enrollment
    const [enrollRows] = await pool.query(
      'SELECT * FROM student_classes WHERE student_id = ? AND class_id = ?',
      [studentId, class_id]
    );
    if (enrollRows.length === 0)
      return res.status(403).json({ message: 'Not enrolled in this class' });

    // ✅ prevent duplicates for same day
    const [existing] = await pool.query(
      'SELECT * FROM attendance WHERE student_id = ? AND class_id = ? AND DATE(timestamp) = CURDATE()',
      [studentId, class_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ message: 'Attendance already marked today' });

    // ✅ mark attendance
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