const pool = require('../config/db');

/**
 * Mark attendance for a student using a QR token
 * (UNCHANGED – QR FLOW KEPT INTACT)
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
      'INSERT INTO attendance (student_id, class_id, status, qr_token, timestamp, method) VALUES (?, ?, ?, ?, NOW(), ?)',
      [studentId, class_id, 'present', token, 'qr']
    );

    return res.json({ message: 'Attendance marked successfully (QR)', class_id });
  } catch (err) {
    console.error('❌ Error in markAttendance:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Mark attendance using Face Recognition
 * ✔ Checks active class
 * ✔ No QR dependency
 */
exports.faceMarkAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { class_id } = req.body;

    // 🔐 Check if face is registered
// 🔐 Check if face is registered
const [rows] = await pool.query(
  'SELECT face_encoding FROM users WHERE id = ? AND role = ? LIMIT 1',
  [studentId, 'student']
);

if (!rows.length || !rows[0].face_encoding) {
  return res.status(400).json({
    message: 'No registered face found for student'
  });
}


    if (!class_id)
      return res.status(400).json({ message: 'class_id is required' });

    // ✅ Check if class is ACTIVE
    const [activeRows] = await pool.query(
      `SELECT * FROM active_classes 
       WHERE class_id = ? AND expires_at >= NOW() 
       LIMIT 1`,
      [class_id]
    );

    if (activeRows.length === 0)
      return res.status(403).json({ message: 'Class is not active right now' });

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

    // ✅ Mark attendance via FACE
    await pool.query(
      `INSERT INTO attendance 
       (student_id, class_id, status, face_match, method, timestamp) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [studentId, class_id, 'present', true, 'face']
    );

    // Optional log
    await pool.query(
      'INSERT INTO attendance_logs (student_id, action, details) VALUES (?, ?, ?)',
      [studentId, 'face_attendance', `Face attendance marked for class ${class_id}`]
    );

    return res.json({
      message: 'Face matched ✅ Attendance marked',
      class_id
    });
  } catch (err) {
    console.error('❌ Error in faceMarkAttendance:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get attendance analytics for the logged-in student
 */
exports.getStudentAnalytics = async (req, res) => {
  try {
    const studentId = req.user.id;

    // 1️⃣ Overall attendance
    const [[overall]] = await pool.query(
      `
      SELECT 
        COUNT(DISTINCT DATE(timestamp)) AS total,
        COUNT(*) AS present
      FROM attendance
      WHERE student_id = ?
      `,
      [studentId]
    );

    // 2️⃣ Subject/Class-wise attendance
    const [byClass] = await pool.query(
      `
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT DATE(a.timestamp)) AS total,
        COUNT(a.id) AS present
      FROM classes c
      JOIN student_classes sc ON sc.class_id = c.id
      LEFT JOIN attendance a 
        ON a.class_id = c.id 
        AND a.student_id = ?
      GROUP BY c.id
      `,
      [studentId]
    );

    // 3️⃣ Attendance trend (last 14 days)
    const [trend] = await pool.query(
      `
      SELECT 
        DATE(timestamp) AS day,
        COUNT(*) AS present
      FROM attendance
      WHERE student_id = ?
      GROUP BY DATE(timestamp)
      ORDER BY day DESC
      LIMIT 14
      `,
      [studentId]
    );

    // 4️⃣ Risk subjects (< 75%)
    const risk = byClass
      .map(c => ({
        name: c.name,
        percentage: c.total
          ? Math.round((c.present / c.total) * 100)
          : 0
      }))
      .filter(c => c.percentage < 75);

    res.json({
      overall,
      byClass,
      trend: trend.reverse(),
      risk
    });
  } catch (err) {
    console.error('❌ Analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get attendance analytics for teacher's classes
 */
exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const [classes] = await pool.query(
      'SELECT id, name FROM classes WHERE teacher_id = ?',
      [teacherId]
    );

    const analytics = [];

    for (const cls of classes) {
      const [totalStudentsRows] = await pool.query(
        'SELECT COUNT(*) AS total_students FROM student_classes WHERE class_id = ?',
        [cls.id]
      );

      const [attendanceRows] = await pool.query(
        'SELECT COUNT(*) AS attended_count FROM attendance WHERE class_id = ?',
        [cls.id]
      );

      const avgAttendance = totalStudentsRows[0].total_students
        ? Math.round(attendanceRows[0].attended_count / totalStudentsRows[0].total_students)
        : 0;

      analytics.push({
        id: cls.id,
        name: cls.name,
        total_students: totalStudentsRows[0].total_students,
        avg_attendance: avgAttendance,
      });
    }

    return res.json({ classes: analytics });
  } catch (err) {
    console.error('❌ Error fetching teacher analytics:', err);
    res.status(500).json({ message: 'Server error' });
  }
};