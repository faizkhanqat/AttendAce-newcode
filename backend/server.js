const fs = require('fs');
const path = require('path');
const https = require('https');
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

// SSL
const keyPath = path.join(__dirname, 'ssl', 'server.key');
const certPath = path.join(__dirname, 'ssl', 'server.crt');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('❌ SSL certificate or key not found. Check your ssl folder path.');
  process.exit(1);
}

const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// Middleware
app.use(cors({
  origin: ['https://localhost:3700', 'https://127.0.0.1:3700', 'http://localhost:3700'],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// Serve frontend directly
const frontendPath = path.join(__dirname, '../frontend'); // <-- point to frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/qr', qrRoutes);

// Catch-all to serve index/login page
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

// Start server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS server running at https://localhost:${PORT}`);
});