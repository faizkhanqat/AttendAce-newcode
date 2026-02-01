const pool = require('../config/db'); // MySQL pool
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

  if (role === 'student' && !req.body.department) {
    return res.status(400).json({ message: 'Department required for students' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

// Insert user with department; aviation_id will be generated after insert
const [result] = await pool.query(
  'INSERT INTO users (name, email, password_hash, role, gender, dob, department) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [name, email, hashedPassword, role, gender || null, dob || null, req.body.department || null]
);

// Generate aviation_id
const aviationId = `${role === 'student' ? 'STD-' : 'TCH-'}${String(result.insertId).padStart(4, '0')}`;

await pool.query(
  'UPDATE users SET aviation_id = ? WHERE id = ?',
  [aviationId, result.insertId]
);

const [newUser] = await pool.query(
  'SELECT id, name, email, role, gender, dob, department, aviation_id FROM users WHERE id = ?',
  [result.insertId]
);

    // ------------------ SEND CREATIVE WELCOME EMAIL ------------------
    try {
      await sgMail.send({
        to: newUser[0].email,
        from: EMAIL_FROM,
        subject: `🎉 Welcome to AttendAce, ${newUser[0].name}!`,
        text: `Hi ${newUser[0].name},

Welcome to AttendAce! Kevin Hamad and the AttendAce Team are thrilled to have you on board.

You can now log in and start exploring all the features we've built for you.

Cheers,
Kevin Hamad & AttendAce Team 🚀`,
        html: `
          <div style="font-family: Arial, sans-serif; background:#f0f2f5; padding:20px;">
            <div style="max-width:550px; margin:auto; background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 6px 18px rgba(0,0,0,0.1); text-align:center;">
              
              <h1 style="color:#2d6a4f; font-size:28px; margin-bottom:10px;">🎉 Welcome to AttendAce, ${newUser[0].name}! 🎉</h1>
              
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
    const [users] = await pool.query(
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

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
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