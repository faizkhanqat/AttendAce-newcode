//backend//controllers/authController.js
const db = require('../config/db'); // MySQL pool
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;

// --- Register ---
exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    const [newUser] = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [result.insertId]);

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

// --- Login ---
exports.login = async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
    if (users.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};