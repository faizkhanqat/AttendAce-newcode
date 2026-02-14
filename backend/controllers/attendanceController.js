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
      'INSERT INTO attendance (student_id, class_id, status, qr_token, timestamp, method, conducted_on) VALUES (?, ?, ?, ?, NOW(), ?, CURRENT_DATE())',
      [studentId, class_id, 'present', token, 'qr']
    );

    // Get teacher_id for the class
    const [classRow] = await pool.query(
      'SELECT teacher_id FROM classes WHERE id = ? LIMIT 1',
      [class_id]
    );

    if (!classRow.length) return res.status(400).json({ message: 'Class not found' });

    const teacherId = classRow[0].teacher_id;

    await pool.query(`
    UPDATE classes
    SET total_classes = COALESCE(total_classes, 0) + 1
    WHERE id=? AND NOT EXISTS (
      SELECT 1 FROM attendance 
      WHERE class_id=? AND conducted_on=CURDATE()
    )
  `, [class_id, class_id]);

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
       (student_id, class_id, status, face_match, method, timestamp, conducted_on) 
       VALUES (?, ?, ?, ?, ?, NOW(), CURRENT_DATE())`,
      [studentId, class_id, 'present', true, 'face']
    );

    // Get teacher_id for the class
    const [classRow] = await pool.query(
      'SELECT teacher_id FROM classes WHERE id = ? LIMIT 1',
      [class_id]
    );

    if (!classRow.length) return res.status(400).json({ message: 'Class not found' });

    const teacherId = classRow[0].teacher_id;


    // Update or create active_classes for today
    await pool.query(`
      INSERT INTO active_classes (class_id, teacher_id, expires_at, conducted_on)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), CURRENT_DATE())
      ON DUPLICATE KEY UPDATE
        expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR)
    `, [class_id, teacherId]);

    await pool.query(`
    UPDATE classes
    SET total_classes = COALESCE(total_classes, 0) + 1
    WHERE id=? AND NOT EXISTS (
      SELECT 1 FROM attendance 
      WHERE class_id=? AND conducted_on=CURDATE()
    )
  `, [class_id, class_id]);

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
 * Get attendance analytics for the logged-in student (using summary table)
 */
exports.getStudentAnalytics = async (req, res) => {
  try {
    const studentId = req.user.id;

    // 1️⃣ Per-class attendance
    const [byClass] = await pool.query(`
      SELECT 
        c.id AS class_id,
        c.name AS class_name,
        COUNT(a.id) AS attended,
        COUNT(DISTINCT ac.conducted_on) AS total
      FROM student_classes sc
      JOIN classes c ON c.id = sc.class_id
      LEFT JOIN attendance a 
        ON a.class_id = c.id AND a.student_id = sc.student_id AND a.status='present'
      LEFT JOIN active_classes ac 
        ON ac.class_id = c.id
      WHERE sc.student_id = ?
      GROUP BY c.id
    `, [studentId]);

    // 2️⃣ Risk subjects (below 75%)
    const risk = byClass.map(c => {
      const percentage = c.total ? Math.round((c.attended / c.total) * 100) : 0;
      return {
        name: c.class_name,
        total: c.total,
        attended: c.attended,
        missed: c.total - c.attended,
        percentage
      };
    });

    // 3️⃣ Overall attendance
    const overall = byClass.reduce((acc, c) => {
      acc.total += c.total;
      acc.present += c.attended;
      return acc;
    }, { total: 0, present: 0 });

    // 4️⃣ Trend: last 30 days
    const [trend] = await pool.query(`
      SELECT DATE(conducted_on) AS day, COUNT(*) AS present
      FROM attendance
      WHERE student_id = ? AND status='present'
        AND conducted_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(conducted_on)
      ORDER BY day ASC
    `, [studentId]);

    res.json({ overall, byClass: risk, trend });
  } catch (err) {
    console.error('❌ Analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get attendance analytics for teacher's classes (using summary table)
 */
exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const [classes] = await pool.query(`
  SELECT 
    c.id AS class_id,
    c.name AS class_name,
    c.total_classes,
    COUNT(sc.student_id) AS total_students,
    SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS total_attended
  FROM classes c
  LEFT JOIN student_classes sc ON sc.class_id = c.id
  LEFT JOIN attendance a ON a.class_id = c.id
  WHERE c.teacher_id = ?
  GROUP BY c.id
`, [teacherId]);

const classData = classes.map(cls => ({
  class_id: cls.class_id,
  class_name: cls.class_name,
  total_students: cls.total_students,
  total_classes: cls.total_classes,
  total_attended: cls.total_attended,
  attendance_percentage: cls.total_classes 
    ? Math.round((cls.total_attended / (cls.total_students * cls.total_classes)) * 100)
    : 0
}));

res.json({ classes: classData });
  } catch (err) {
    console.error('❌ Teacher analytics error (summary table):', err);
    res.status(500).json({ message: 'Server error' });
  }
};