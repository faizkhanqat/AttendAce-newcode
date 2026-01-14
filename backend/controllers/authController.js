const db = require('../config/db'); // MySQL pool
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;

// SendGrid config
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

sgMail.setApiKey(SENDGRID_API_KEY);

// ------------------ REGISTER ------------------
exports.register = async (req, res) => {
  const { name, email, password, role, gender, dob } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [existing] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, gender, dob) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, gender || null, dob || null]
    );

    const [newUser] = await db.query(
      'SELECT id, name, email, role, gender, dob FROM users WHERE id = ?',
      [result.insertId]
    );

    const token = jwt.sign(
      { id: newUser[0].id, role: newUser[0].role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: newUser[0]
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ------------------ LOGIN ------------------
exports.login = async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? AND role = ?',
      [email, role]
    );
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender || null,
        dob: user.dob || null
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ------------------ FORGOT PASSWORD / OTP ------------------

// 1️⃣ Request OTP
exports.requestOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await db.query(
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
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP required' });
  }

  try {
    const [users] = await db.query(
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

    res.json({ message: 'OTP verified. You can reset your password now.' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// 3️⃣ Reset Password
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      message: 'Email, OTP, and new password required'
    });
  }

  try {
    const [users] = await db.query(
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

    await db.query(
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