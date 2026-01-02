//backend/server.js
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const qrRoutes = require('./routes/qrRoutes');

const app = express();
const PORT = process.env.PORT || 3700;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Frontend folder
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/qr', qrRoutes);

// Frontend fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});