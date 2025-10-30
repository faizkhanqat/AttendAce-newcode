// backend/controllers/attendanceController.js

const pool = require('../config/db');
console.log('POOL IMPORT CHECK:', pool); // <-- move log here

exports.markAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { class_id, token } = req.body;

    console.log('DEBUG values:', { studentId: req.user?.id, class_id, token });

    if (!class_id || !token) {
      return res.status(400).json({ message: 'class_id and token are required' });
    }

    console.log('DEBUG QUERY START', class_id, token);
const query = `
  SELECT * FROM qr_tokens
  WHERE class_id = ? AND token = ? AND expires_at >= NOW()
  ORDER BY id DESC LIMIT 1
`;
console.log('QR QUERY:', query);

const [qrRows] = await pool.query(query, [class_id, token]);

    // check the student is enrolled in the class
    const [enrollRows] = await pool.query(
      'SELECT * FROM student_classes WHERE student_id = ? AND class_id = ?',
      [studentId, class_id]
    );
    if (!enrollRows || enrollRows.length === 0) {
      return res.status(403).json({ message: 'You are not enrolled in this class' });
    }

    // avoid duplicate attendance same day
    const [existing] = await pool.query(
      'SELECT * FROM attendance WHERE student_id = ? AND class_id = ? AND DATE(timestamp) = CURDATE()',
      [studentId, class_id]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Attendance already marked for today' });
    }

    // mark attendance
    await pool.query(
      'INSERT INTO attendance (student_id, class_id, status, qr_token, timestamp) VALUES (?, ?, ?, ?, NOW())',
      [studentId, class_id, 'present',token]
    );

    return res.json({ message: 'Attendance marked successfully', class_id });
  } catch (err) {
    console.error('Error in markAttendance:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};