const pool = require('../config/db'); // MySQL pool
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();
const { mode: AUTH_MODE } = require('../config/authMode');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;

// SendGrid config
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}



// ------------------ LOGIN ------------------
exports.login = async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND role = ? AND is_verified = TRUE',
      [email, role]
    );
    if (users.length === 0) {
      return res.status(400).json({ message: 'Account not verified or invalid credentials' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: 'Account not verified or invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);


    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Determine missing fields
    const missingFields = [];

    if (!user.name) missingFields.push('name');
    if (!user.gender) missingFields.push('gender');
    if (!user.dob) missingFields.push('dob');

    if (user.role === 'student' && !user.department) {
      missingFields.push('department');
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        dob: user.dob,
        department: user.department,
        aviation_id: user.aviation_id
      },
      isComplete: missingFields.length === 0,
      missingFields
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ------------------ FORGOT PASSWORD / OTP ------------------

// 1️⃣ Request OTP
exports.requestOtp = async (req, res) => {
  if (AUTH_MODE !== 'otp') {
    return res.status(400).json({
      message: 'OTP functionality is disabled'
    });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await pool.query(
      'UPDATE users SET otp_code = ?, otp_expires = ? WHERE email = ?',
      [otp, expires, email]
    );

    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      subject: '🤦 Forgot your password… again?',
      text: `Hey ${user.name},

    Looks like you forgot your password.
    No worries — it happens to the best of us (and also everyone else).

    Here’s your OTP to reset your AttendAce password:
    ${otp}

    This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.

    If you didn’t request this, you can safely ignore this email.

    – Kevin Hamad
    AttendAce Team`,
      
      html: `
      <div style="font-family: Arial, sans-serif; background:#f9fafb; padding:20px;">
        <div style="max-width:500px; margin:auto; background:#ffffff; border-radius:12px; padding:24px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          
          <h2 style="color:#2d6a4f; margin-top:0;">Hey ${user.name} 👋</h2>
          
          <p style="color:#333; font-size:15px;">
            Looks like you forgot your password.<br>
            Don’t worry — it happens to literally everyone.
          </p>

          <p style="color:#333; font-size:15px;">
            Here’s your OTP to reset your <strong>AttendAce</strong> password:
          </p>

          <div style="font-size:28px; font-weight:bold; letter-spacing:4px; color:#1b4332; background:#e9f5ec; padding:12px; text-align:center; border-radius:8px; margin:16px 0;">
            ${otp}
          </div>

          <p style="font-size:14px; color:#555;">
            ⏳ This OTP is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
          </p>

          <p style="font-size:13px; color:#777;">
            Didn’t request this? No action needed — just ignore this email.
          </p>

          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">

          <p style="font-size:14px; color:#444;">
            With care (and slightly raised eyebrows),<br>
            <strong>Kevin Hamad</strong><br>
            AttendAce Team 🚀
          </p>

          <p style="font-size:12px; color:#999;">
            P.S. Please remember your new password this time. We believe in you.
          </p>
        </div>
      </div>
      `
    });

    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Request OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 2️⃣ Verify OTP
exports.verifyOtp = async (req, res) => {
  if (AUTH_MODE !== 'otp') {
    return res.status(400).json({
      message: 'OTP functionality is disabled'
    });
  }

  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP required' });
  }

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    if (!user.otp_code || !user.otp_expires) {
      return res.status(400).json({ message: 'No OTP requested' });
    }
    if (user.otp_code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (new Date(user.otp_expires) < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // 🔐 Make OTP single-use
    await pool.query(
      'UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE email = ?',
      [email]
    );

    res.json({ message: 'OTP verified. You can reset your password now.' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 3️⃣ Reset Password
exports.resetPassword = async (req, res) => {
  if (AUTH_MODE !== 'otp') {
    return res.status(400).json({
      message: 'OTP functionality is disabled'
    });
  }

  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      message: 'Email, OTP, and new password required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      message: 'Password must be at least 6 characters'
    });
  }

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    if (!user.otp_code || !user.otp_expires) {
      return res.status(400).json({ message: 'No OTP requested' });
    }
    if (user.otp_code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (new Date(user.otp_expires) < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query(
      'UPDATE users SET password_hash = ?, otp_code = NULL, otp_expires = NULL WHERE email = ?',
      [hashedPassword, email]
    );

    res.json({
      message: 'Password reset successful. You can now login with new password.'
    });
  } catch (err) {
    console.error('Reset Password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ------------------ REGISTER OTP REQUEST ------------------
exports.registerRequestOtp = async (req, res) => {
  // 🔥 BYPASS OTP IF DISABLED
  if (AUTH_MODE !== 'otp') {
    try {
    const { name, email, password, role, gender, dob, department } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existing] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO users 
      (name, email, password_hash, role, gender, dob, department, mode, is_verified) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        name,
        email,
        hashedPassword,
        role,
        gender || null,
        dob || null,
        department || null,
        role === 'student' ? 'gaming' : 'official'
      ]
    );

    const aviationId = `${role === 'student' ? 'STD-' : 'TCH-'}${String(result.insertId).padStart(4, '0')}`;

    await pool.query(
      'UPDATE users SET aviation_id = ? WHERE id = ?',
      [aviationId, result.insertId]
    );

    const token = jwt.sign(
      { id: result.insertId, role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(201).json({
      message: 'Registered successfully (OTP disabled)',
      token
    });
    } catch(err){
      console.error('Register (no OTP) error:', err);
     return res.status(500).json({ message: 'Server error' });
    }
  }


  const { name, email, password, role, gender, dob, department } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    await pool.query(
      'DELETE FROM users WHERE email = ? AND is_verified = FALSE',
      [email]
    );
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await pool.query(
      'INSERT INTO users (name, email, password_hash, role, gender, dob, department, reg_otp_code, reg_otp_expires, mode, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)',
      [
        name,
        email,
        await bcrypt.hash(password, SALT_ROUNDS),
        role,
        gender || null,
        dob || null,
        department || null,
        otp,
        expires,
        role === 'student' ? 'gaming' : 'official'
      ]
    );

    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      subject: '🔐 Verify your AttendAce account',
      html: `
        <div style="font-family:Arial;padding:20px">
          <h2>Verify Your Account</h2>
          <p>Your OTP is:</p>
          <div style="font-size:28px;font-weight:bold">${otp}</div>
          <p>This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
      `
    });

    res.json({ message: 'OTP sent to your email. Please verify to complete registration.' });

  } catch (err) {
    console.error('Register OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ------------------ VERIFY REGISTER OTP ------------------
exports.registerVerifyOtp = async (req, res) => {

  if (AUTH_MODE !== 'otp') {
    return res.status(400).json({
      message: 'OTP functionality is disabled'
    });
  }

  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP required' });
  }

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    if (!user.reg_otp_code || !user.reg_otp_expires) {
      return res.status(400).json({ message: 'No registration OTP requested' });
    }

    if (user.reg_otp_code !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date(user.reg_otp_expires) < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Clear registration OTP
    await pool.query(
      'UPDATE users SET reg_otp_code = NULL, reg_otp_expires = NULL, is_verified = TRUE WHERE email = ?',
      [email]
    );

    // Generate aviation_id
    const aviationId = `${user.role === 'student' ? 'STD-' : 'TCH-'}${String(user.id).padStart(4, '0')}`;

    await pool.query(
      'UPDATE users SET aviation_id = ? WHERE id = ?',
      [aviationId, user.id]
    );

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    try {
      await sgMail.send({
        to: user.email,
        from: EMAIL_FROM,
        subject: `🎉 Welcome to AttendAce, ${user.name}!`,
        text: `Hi ${user.name},

Welcome to AttendAce! Kevin Hamad and the AttendAce Team are thrilled to have you on board.

You can now log in and start exploring all the features we've built for you.

Cheers,
Kevin Hamad & AttendAce Team 🚀`,
        html: `
          <div style="font-family: Arial, sans-serif; background:#f0f2f5; padding:20px;">
            <div style="max-width:550px; margin:auto; background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 6px 18px rgba(0,0,0,0.1); text-align:center;">
              
              <h1 style="color:#2d6a4f; font-size:28px; margin-bottom:10px;">🎉 Welcome to AttendAce, ${user.name}! 🎉</h1>
              
              <p style="color:#333; font-size:16px; line-height:1.5;">
                Kevin Hamad and the entire AttendAce Team are thrilled to have you onboard. <br>
                You now have access to all the tools to manage attendance and classes effortlessly.
              </p>

              <div style="background:#e9f5ec; color:#1b4332; padding:16px; margin:20px 0; border-radius:8px; font-size:18px; font-weight:bold;">
                Start exploring your dashboard today!
              </div>

              <p style="color:#555; font-size:14px; margin-bottom:25px;">
                Need help? We're always here for you — just reply to this email.
              </p>

              <a href="https://attendace-zjzu.onrender.com/login.html" style="display:inline-block; background:#2d6a4f; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-size:16px; margin-bottom:20px;">
                Explore AttendAce
              </a>

              <p style="font-size:14px; color:#444; margin-top:30px;">
                Warm regards,<br>
                <strong>Kevin Hamad & AttendAce Team 🚀</strong>
              </p>

              <p style="font-size:12px; color:#999;">
                P.S. Remember: Great things happen when you attend on time! 😉
              </p>

            </div>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Welcome email error:', emailErr);
    }

    res.json({
      message: 'Registration verified successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        dob: user.dob,
        department: user.department,
        aviation_id: aviationId
      }
    });

  } catch (err) {
    console.error('Register verify error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};