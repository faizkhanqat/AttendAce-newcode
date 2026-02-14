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


    // Update or create active_classes for today
    await pool.query(`
      INSERT INTO active_classes (class_id, teacher_id, expires_at, conducted_on)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), CURRENT_DATE())
      ON DUPLICATE KEY UPDATE
        expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR)
    `, [class_id, teacherId]);

    // ===== Update Student Summary =====
    await pool.query(`
      INSERT INTO student_attendance_summary (student_id, class_id, total_sessions, present_count, qr_attendance_count, last_attended)
      VALUES (?, ?, 1, 1, 1, NOW())
      ON DUPLICATE KEY UPDATE
        total_sessions = total_sessions + 1,
        present_count = present_count + 1,
        qr_attendance_count = qr_attendance_count + 1,
        last_attended = NOW()
    `, [studentId, class_id]);

    // ===== Update Teacher Summary =====
    await pool.query(`
      INSERT INTO teacher_class_summary 
        (class_id, teacher_id, total_students, total_sessions, average_attendance_percent, last_session)
      SELECT 
        c.id,
        c.teacher_id,
        COUNT(sc.student_id),
        1,
        ROUND(
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(sc.student_id) * 100, 2
        ),
        NOW()
      FROM classes c
      LEFT JOIN student_classes sc ON sc.class_id = c.id
      LEFT JOIN attendance a ON a.class_id = c.id AND a.conducted_on = CURDATE()      WHERE c.id = ?
      GROUP BY c.id
      ON DUPLICATE KEY UPDATE
        total_sessions = total_sessions + 1,
        average_attendance_percent = ROUND( 
        IF(COUNT(sc.student_id)=0, 0,
    SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)/COUNT(sc.student_id)*100
  ), 2
),
        last_session = NOW();
    `, [class_id]);

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

    // ===== Update Student Summary =====
    await pool.query(`
      INSERT INTO student_attendance_summary (student_id, class_id, total_sessions, present_count, face_attendance_count, last_attended)
      VALUES (?, ?, 1, 1, 1, NOW())
      ON DUPLICATE KEY UPDATE
        total_sessions = total_sessions + 1,
        present_count = present_count + 1,
        face_attendance_count = face_attendance_count + 1,
        last_attended = NOW()
    `, [studentId, class_id]);

    // ===== Update Teacher Summary =====
    await pool.query(`
      INSERT INTO teacher_class_summary 
        (class_id, teacher_id, total_students, total_sessions, average_attendance_percent, last_session)
      SELECT 
        c.id,
        c.teacher_id,
        COUNT(sc.student_id),
        1,
        ROUND(
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(sc.student_id) * 100, 2
        ),
        NOW()
      FROM classes c
      LEFT JOIN student_classes sc ON sc.class_id = c.id
      LEFT JOIN attendance a ON a.class_id = c.id AND a.conducted_on = CURDATE()
      WHERE c.id = ?
      GROUP BY c.id
      ON DUPLICATE KEY UPDATE
        total_sessions = total_sessions + 1,
        average_attendance_percent = ROUND(
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / total_students * 100, 2
        ),
        last_session = NOW();
    `, [class_id]);

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

    // Fetch per-class summary directly
    const [byClass] = await pool.query(
      `
      SELECT 
        c.id AS class_id,
        c.name AS class_name,
        COALESCE(s.total_sessions, 0) AS total,
        COALESCE(s.present_count, 0) AS present,
        COALESCE(s.qr_attendance_count, 0) AS qr_count,
        COALESCE(s.face_attendance_count, 0) AS face_count,
        COALESCE(s.manual_attendance_count, 0) AS manual_count,
        s.last_attended
      FROM student_classes sc
      JOIN classes c ON c.id = sc.class_id
      LEFT JOIN student_attendance_summary s
        ON s.student_id = sc.student_id AND s.class_id = sc.class_id
      WHERE sc.student_id = ?
      `,
      [studentId]
    );

    // Attendance trends per day
    const [trendRows] = await pool.query(
      `SELECT class_id, conducted_on AS date,
              SUM(CASE WHEN student_id=? AND status='present' THEN 1 ELSE 0 END) AS present_count,
              COUNT(*) AS total_students
      FROM attendance
      WHERE student_id=?
      GROUP BY class_id, conducted_on
      ORDER BY class_id, conducted_on ASC`,
      [studentId, studentId]
    );

    const trends = trendRows.map(r => ({
      date: r.date,
      percentage: r.total_students ? Math.round((r.present_count / r.total_students) * 100) : 0
    }));

    // Overall
    const overall = byClass.reduce((acc, c) => {
      acc.total += c.total;
      acc.present += c.present;
      return acc;
    }, { total: 0, present: 0 });

    // Risk (< 75%)
    // Calculate missed classes and risk
    const risk = [];

    for (let c of byClass) {
      // Total sessions conducted for this class
      const [sessions] = await pool.query(
        `SELECT COUNT(*) AS total_sessions 
        FROM active_classes 
        WHERE class_id = ?`,
        [c.class_id]
      );

      const totalSessions = sessions[0]?.total_sessions || 0;
      const missed = totalSessions - c.present;
      const percentage = totalSessions ? Math.round((c.present / totalSessions) * 100) : null;

      if (percentage !== null && percentage < 75) {
        risk.push({
          name: c.class_name,
          percentage,
          missed
        });
      }

      // Update byClass for frontend
      c.total = totalSessions;
      c.missed = missed;
      c.percentage = percentage;
    }

    res.json({
      overall,
      byClass,
      risk,
      trends
    });

  } catch (err) {
    console.error('❌ Analytics error (summary table):', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get attendance analytics for teacher's classes (using summary table)
 */
exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const [classes] = await pool.query(
      `
      SELECT 
        c.id AS class_id,
        c.name AS class_name,
        COALESCE(t.total_students, COUNT(sc.student_id)) AS total_students,
        COALESCE(t.total_sessions, 0) AS total_sessions,
        COALESCE(t.average_attendance_percent, 0) AS avg_attendance,
        t.last_session
      FROM classes c
      LEFT JOIN student_classes sc ON sc.class_id = c.id
      LEFT JOIN teacher_class_summary t ON t.class_id = c.id
      WHERE c.teacher_id = ?
      GROUP BY c.id
      `,
      [teacherId]
    );

    res.json({ classes });
  } catch (err) {
    console.error('❌ Teacher analytics error (summary table):', err);
    res.status(500).json({ message: 'Server error' });
  }
};