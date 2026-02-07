const pool = require('../config/db');

// ==========================
// Get teacher profile
// ==========================
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
        'SELECT id, name, email, role, department, gender, dob, aviation_id, mode FROM users WHERE id = ?',
        [req.user.id]
      );
      res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================
// Update teacher profile
// ==========================
exports.updateProfile = async (req, res) => {
  try {
  const { name, email, department, gender, dob, mode} = req.body;

  const fields = [];
  const values = [];

  if (name) { fields.push('name = ?'); values.push(name); }
  if (email) { fields.push('email = ?'); values.push(email); }
  if (department) { fields.push('department = ?'); values.push(department); }
  if (gender) { fields.push('gender = ?'); values.push(gender); }
  if (dob) { fields.push('dob = ?'); values.push(dob); }
  if (mode) {
  fields.push('mode = ?');
  values.push(mode);
}

  if (fields.length === 0)
    return res.status(400).json({ message: 'Nothing to update' });

  await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    [...values, req.user.id]
  );

  const [updated] = await pool.query(
    'SELECT id, name, email, role, department, gender, dob, aviation_id FROM users WHERE id = ?',
    [req.user.id]
  );

  res.json({ message: 'Profile updated successfully', user: updated[0] });
} catch (err) {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
}
};

// ==========================
// Get classes (with is_active)
// ==========================
exports.getClasses = async (req, res) => {
  try {
    const [classes] = await pool.query(
      `SELECT c.*,
              IF(ac.expires_at >= NOW(), TRUE, FALSE) AS is_active
       FROM classes c
       LEFT JOIN active_classes ac ON c.id = ac.class_id
       WHERE c.teacher_id = ?`,
      [req.user.id]
    );
    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================
// Add new class
// ==========================
exports.addClass = async (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name)
      return res.status(400).json({ message: 'Class name required' });

    const [result] = await pool.query(
      'INSERT INTO classes (name, subject, teacher_id) VALUES (?, ?, ?)',
      [name, subject || '', req.user.id]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      subject: subject || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==========================
// Generate QR (UNCHANGED)
// ==========================
exports.generateQR = async (req, res) => {
  try {
    const { class_id, token, duration } = req.body;
    if (!class_id || !token)
      return res.status(400).json({ message: 'Missing data' });

    const qrDuration = duration || 15;

    await pool.query(
      'INSERT INTO qr_tokens (class_id, token, duration, created_at) VALUES (?, ?, ?, NOW())',
      [class_id, token, qrDuration]
    );

    res.status(201).json({
      message: 'QR registered',
      token,
      class_id,
      duration: qrDuration
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// =====================================================
// ✅ ACTIVATE CLASS (NEW – for Face Attendance)
// =====================================================
exports.activateClass = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { class_id, minutes } = req.body;

    if (!class_id)
      return res.status(400).json({ message: 'class_id is required' });

    const activeMinutes = minutes || 3;

    // Verify class belongs to teacher
    const [classRows] = await pool.query(
      'SELECT * FROM classes WHERE id = ? AND teacher_id = ?',
      [class_id, teacherId]
    );

    if (classRows.length === 0)
      return res.status(403).json({ message: 'Unauthorized class access' });

    // Remove old active entry if exists
    await pool.query(
      'DELETE FROM active_classes WHERE class_id = ?',
      [class_id]
    );

    // Activate class
    await pool.query(
      `INSERT INTO active_classes (class_id, teacher_id, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [class_id, teacherId, activeMinutes]
    );

    res.json({
      message: `Class activated for ${activeMinutes} minute(s)`,
      class_id,
      expires_in_minutes: activeMinutes
    });
  } catch (err) {
    console.error('❌ Activate class error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// =====================================================
// ⛔ DEACTIVATE CLASS (OPTIONAL / MANUAL STOP)
// =====================================================
exports.deactivateClass = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { class_id } = req.body;

    if (!class_id)
      return res.status(400).json({ message: 'class_id is required' });

    await pool.query(
      'DELETE FROM active_classes WHERE class_id = ? AND teacher_id = ?',
      [class_id, teacherId]
    );

    res.json({
      message: 'Class deactivated',
      class_id
    });
  } catch (err) {
    console.error('❌ Deactivate class error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};