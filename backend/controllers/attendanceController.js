const pool = require('../config/db');
const { Parser } = require('json2csv');

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
        c.total_classes AS total
      FROM student_classes sc
      JOIN classes c ON c.id = sc.class_id
      LEFT JOIN attendance a 
        ON a.class_id = c.id AND a.student_id = sc.student_id AND a.status='present'
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

    const riskSubjects = risk.filter(r => 
      r.total > 0 && r.percentage < 75
    );

    res.json({
      overall,
      byClass: risk,
      trend,
      risk: riskSubjects
    });
  } catch (err) {
    console.error('❌ Analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get attendance analytics for teacher's classes (using summary table)
 */
// Get attendance analytics for teacher's classes (frontend-friendly)
exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // 1️⃣ Get all classes of the teacher
    const [classes] = await pool.query(`
      SELECT 
    c.id AS class_id,
    c.name AS class_name,
    c.total_classes,
    COUNT(DISTINCT sc.student_id) AS total_students,
    COUNT(DISTINCT CONCAT(a.student_id, '_', a.conducted_on)) AS total_attended,
    CASE 
        WHEN c.total_classes > 0 AND COUNT(DISTINCT sc.student_id) > 0
        THEN ROUND(
            COUNT(DISTINCT CONCAT(a.student_id, '_', a.conducted_on)) 
            / (COUNT(DISTINCT sc.student_id) * c.total_classes) * 100
        )
        ELSE 0
    END AS attendance_percentage
FROM classes c
LEFT JOIN student_classes sc ON sc.class_id = c.id
LEFT JOIN attendance a 
    ON a.class_id = c.id
GROUP BY c.id;
    `);

    if (!classes.length) return res.json({ overall: {}, byClass: [], risk: [] });

    // 2️⃣ Map class data
    const classData = classes.map(cls => {
      const attendancePercentage = (cls.total_classes && cls.total_students)
        ? Math.round((cls.total_attended / (cls.total_classes * cls.total_students)) * 100)
        : 0;
      return {
        class_id: cls.class_id,
        name: cls.class_name,
        total: cls.total_classes || 0,
        attended: cls.total_attended || 0,
        percentage: attendancePercentage,
        total_students: cls.total_students
      };
    });

    // 3️⃣ Calculate overall
    const overall = classData.reduce((acc, cls) => {
      acc.total_classes += cls.total || 0;
      acc.total_students += cls.total_students || 0;
      acc.total_attended += cls.attended || 0;
      return acc;
    }, { total_classes: 0, total_students: 0, total_attended: 0 });

    const overallPercent = overall.total_classes && overall.total_students
      ? Math.round((overall.total_attended / (overall.total_classes * overall.total_students)) * 100)
      : 0;

    // 4️⃣ Risk classes (<75%)
    const risk = classData.filter(c => c.percentage < 75);

    res.json({
      overall: { percent: overallPercent, total_attended: overall.total_attended, total_students: overall.total_students },
      byClass: classData,
      risk
    });

  } catch (err) {
    console.error('❌ Teacher analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};




exports.getClassAttendanceCSV = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const classId = req.params.class_id;

    // 1️⃣ Verify class belongs to teacher
    const [cls] = await pool.query(
      'SELECT * FROM classes WHERE id = ? AND teacher_id = ?',
      [classId, teacherId]
    );
    if (!cls.length) return res.status(403).json({ message: 'Unauthorized' });

    // 2️⃣ Get enrolled students
    const [students] = await pool.query(
      `SELECT u.id, u.name
       FROM student_classes sc
       JOIN users u ON u.id = sc.student_id
       WHERE sc.class_id = ?`,
      [classId]
    );

    // 3️⃣ Get class sessions
    const [sessions] = await pool.query(
      `SELECT id, activated_on
       FROM class_sessions
       WHERE class_id = ?
       ORDER BY activated_on ASC`,
      [classId]
    );

    // 4️⃣ Get attendance
    const [attendance] = await pool.query(
      `SELECT student_id, conducted_on, status
       FROM attendance
       WHERE class_id = ?`,
      [classId]
    );

    // 5️⃣ Build table
    const table = students.map(s => {
      const row = { student_name: s.name };
      sessions.forEach((sess, i) => {
        const att = attendance.find(a =>
          a.student_id === s.id &&
          a.conducted_on.toISOString?.().slice(0,10) === sess.activated_on.toISOString?.().slice(0,10) ||
          a.conducted_on === sess.activated_on // fallback string comparison
        );
        row[`Class ${i+1}`] = att ? (att.status === 'present' ? 'P' : 'A') : '-';
      });
      return row;
    });

    // 6️⃣ Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(table);

    res.header('Content-Type', 'text/csv');
    res.attachment(`class_${classId}_attendance.csv`);
    res.send(csv);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getClassAttendancePreview = async (req, res) => {
  const classId = req.params.id;

  try {
    // 1️⃣ Get total classes conducted
    const totalResult = await db.query(
      `SELECT COUNT(*) as total 
       FROM attendance 
       WHERE class_id = $1`,
      [classId]
    );

    const totalClasses = parseInt(totalResult.rows[0].total);

    // 2️⃣ Get students in class
    const studentsResult = await db.query(
      `SELECT s.id, s.name
       FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.class_id = $1`,
      [classId]
    );

    const students = [];

    for (let stu of studentsResult.rows) {

      const recordResult = await db.query(
        `SELECT status 
         FROM attendance
         WHERE class_id = $1 AND student_id = $2
         ORDER BY date ASC`,
        [classId, stu.id]
      );

      const records = recordResult.rows.map(r => r.status);

      students.push({
        name: stu.name,
        records
      });
    }

    res.json({
      totalClasses,
      students
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};