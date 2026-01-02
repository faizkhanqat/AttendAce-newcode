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
      'INSERT INTO attendance (student_id, class_id, status, qr_token, timestamp, method) VALUES (?, ?, ?, ?, NOW(), ?)',
      [studentId, class_id, 'present', token, 'qr']
    );

    return res.json({ message: 'Attendance marked successfully', class_id });
  } catch (err) {
    console.error('❌ Error in markAttendance:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Mark attendance using Face Recognition
 * Expects: student_id, class_id (student ID is also from JWT)
 */
exports.faceMarkAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { class_id } = req.body;

    if (!class_id)
      return res.status(400).json({ message: 'class_id is required' });

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

    // Mark attendance via face recognition
    await pool.query(
      'INSERT INTO attendance (student_id, class_id, status, face_match, method, timestamp) VALUES (?, ?, ?, ?, ?, NOW())',
      [studentId, class_id, 'present', true, 'face']
    );

    // Optional: log the action
    await pool.query(
      'INSERT INTO attendance_logs (student_id, action, details) VALUES (?, ?, ?)',
      [studentId, 'face_marked', `Marked attendance for class ${class_id}`]
    );

    return res.json({ message: 'Face recognition attendance marked', class_id });
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
    console.error('❌ Error fetching student analytics:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get attendance analytics for teacher's classes
 */
exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Fetch classes created by the teacher
    const [classes] = await pool.query(
      'SELECT id, name FROM classes WHERE teacher_id = ?',
      [teacherId]
    );

    const analytics = [];

    for (const cls of classes) {
      // Total students in class
      const [totalStudentsRows] = await pool.query(
        'SELECT COUNT(*) AS total_students FROM student_classes WHERE class_id = ?',
        [cls.id]
      );

      // Total attendance entries for class
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