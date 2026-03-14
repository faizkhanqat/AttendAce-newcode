<div align="center">

<img src="https://raw.githubusercontent.com/faizkhanqat/AttendAce-newcode/refs/heads/main/frontend/assets/logo.png" width="180"/>

# AttendAce

### Smart Attendance System Built for Real Classrooms

Attendance should verify **presence**, not just **device interaction**.  
AttendAce introduces a **session-driven attendance system** designed to prevent proxy attendance while keeping deployment simple.

<br>

![Node.js](https://img.shields.io/badge/Backend-Node.js-green)
![Express](https://img.shields.io/badge/Framework-Express-black)
![MySQL](https://img.shields.io/badge/Database-MySQL-blue)
![TensorFlow](https://img.shields.io/badge/ML-TensorFlow.js-orange)
![Deployment](https://img.shields.io/badge/Deploy-Render-purple)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

<br>

[![Website](https://img.shields.io/badge/Project%20Website-Visit-blue?style=for-the-badge)](https://portfolio-u2ok.onrender.com/attendace-website.html)

[![Live App](https://img.shields.io/badge/Live%20Application-Try%20AttendAce-success?style=for-the-badge)](https://attendace-zjzu.onrender.com/login.html)

<br>

[About](#-about-attendace) •
[Features](#-core-features) •
[Tech Stack](#-tech-stack) •
[Architecture](#-system-architecture) •
[Installation](#-installation--setup)

</div>

---

# 📌 Table of Contents

- [About AttendAce](#-about-attendace)
- [Why AttendAce](#-why-attendace)
- [Core Features](#-core-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [Security Model](#-security-model)
- [API Overview](#-api-overview)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Project Philosophy](#-project-philosophy)

---

# 📖 About AttendAce

AttendAce is a **smart attendance platform** designed to remove the limitations of traditional biometric systems.

Most attendance systems depend on **physical hardware** like fingerprint scanners or RFID machines. These systems often fail due to hardware malfunction, maintenance cost, or proxy attendance.

AttendAce replaces hardware with **software intelligence**.

Instead of verifying a device interaction, AttendAce verifies a **moment in time** using:

• Live session verification  
• Dynamic QR tokens  
• Client-side facial recognition  

This ensures that attendance is recorded **only when the student is actually present during the session**.

---

# 🚀 Why AttendAce

Modern classrooms face multiple attendance challenges:

| Problem | Solution |
|------|------|
Proxy attendance | Face verification |
Hardware dependency | Fully web-based |
QR screenshot sharing | Session-expiring tokens |
Privacy concerns | Client-side biometric processing |
Maintenance cost | Software-only deployment |

The system is designed to be **easy for teachers, secure for institutions, and privacy-respecting for students**.

---

# ✨ Core Features

### 📱 Dynamic QR Attendance

Each class session generates a **unique QR code**.

The QR token:

• expires automatically  
• works only during the active session  
• cannot be reused  

This prevents screenshot or proxy attendance tricks.

---

### 🤖 Client-Side Face Verification

Face matching happens **directly inside the browser** using machine learning.

Benefits:

• no image uploads  
• faster verification  
• improved privacy  

Only **mathematical descriptors** are used.

---

### ⚡ Session-Driven Attendance

Attendance is linked to **live sessions**, not static check-ins.

If the session ends, attendance closes automatically.

---

### 🔐 Privacy-First Design

AttendAce was designed with strict privacy rules.

The system **never stores raw facial images**.

Only face descriptors are stored for identity verification.

---

### 🛰 Real-Time System Monitoring (HEDWIG)

Integrated Telegram alerts allow developers to monitor:

• runtime errors  
• bug reports  
• unexpected events  

This ensures rapid issue detection during live sessions.

---

# 🧰 Tech Stack

| Layer | Technology |
|------|-------------|
| Frontend | HTML5, Vanilla JS, PWA (Progressive Web App) |
| Backend | Node.js, Express.js |
| Database | MySQL (Hosted on Aiven) |
| ML | Face-API.js (TensorFlow.js) |
| Deployment | Render |

---

# 🏗 System Architecture

AttendAce follows a **client-server separation model** where identity verification occurs on the client side while the backend handles authentication and session management.

```
Student Device
     │
     │ QR Scan + Face Verification
     ▼
Frontend (PWA)
     │
     │ REST API Request
     ▼
Backend (Node.js + Express)
     │
     │ Database Queries
     ▼
MySQL Database (Aiven)
```

Key principles:

• minimal server biometric processing  
• privacy-first identity verification  
• secure token-based authentication

---

# 📂 Project Structure

```
├── backend/          # Express server, API routes, Controllers
├── frontend/         # Web interface, PWA assets, Client-side logic
├── assets/models/    # Pre-trained AI models for face detection
└── schema.sql        # Database blueprint for MySQL initialization
```

---

# ⚙ Installation & Setup

Follow these steps to run the project locally.

---

## 1️⃣ Prerequisites

Ensure you have:

- Node.js (v18+)
- MySQL Database

---

## 2️⃣ Clone Repository

```bash
git clone https://github.com/faizkhanqat/AttendAce-newcode.git
cd AttendAce-newcode
```

---

## 3️⃣ Install Dependencies

```bash
cd backend
npm install
```

---

## 4️⃣ Configure Environment Variables

Create a `.env` file in:

```
backend/.env
```

Use the template:

```
backend/.env.example
```

Fill in database credentials and configuration variables.

---

## 5️⃣ Initialize Database

Import the database schema:

```
backend/schema.sql
```

This creates the required tables and indexes.

---

## 6️⃣ Run the Application

```bash
cd backend
npm start
```

---

# 🛡 Security Model

AttendAce follows a **fail-fast verification model**.

Attendance is recorded **only if all conditions pass**:

✔ Valid JWT authentication  
✔ Active class session  
✔ Valid QR token  
✔ Successful face match  

If any condition fails, the request is rejected immediately.

---

### Data Privacy

• Raw facial images are never stored  
• Only face descriptors are saved  
• Client-side ML ensures privacy

---

### Access Control

All routes use **role-based authorization middleware**.

Roles include:

• Students  
• Teachers  
• Administrators

---

### Secure Origin Requirement

Camera access requires **HTTPS**.

This ensures secure biometric verification.

---

# 🔌 API Overview

| Endpoint | Purpose |
|--------|--------|
| `/auth/login` | User authentication |
| `/attendance/start-session` | Teacher starts session |
| `/attendance/mark` | Student marks attendance |
| `/attendance/report` | Generate analytics |
| `/attendance/export` | CSV report export |

All endpoints require **JWT authentication**.

---

# 🚀 Deployment

The application is deployed using **Render**.

Render enables:

• automatic GitHub deployment  
• CI/CD integration  
• server scaling  

Every commit pushed to the repository can trigger an automatic deployment.

---

# 🗺 Roadmap

Future improvements may include:

- mobile app integration
- improved analytics dashboard
- offline attendance syncing
- classroom geofencing
- AI-based spoof detection

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository  
2. Create a feature branch  
3. Submit a pull request  

Possible contributions:

• UI improvements  
• performance optimization  
• security enhancements  
• documentation updates

---

# 💡 Project Philosophy

AttendAce was built on three core principles.

### Simplicity
Systems used daily must remain intuitive.

### Privacy
Biometric verification must respect user data.

### Software Over Hardware
Reliable software can replace expensive biometric machines.

---

## 👥 Team

<table>
<tr>

<td align="center">
<img src="https://github.com/faizkhanqat.png" width="100px"/><br>
<b>FaizKhan17</b><br>
Technical Lead
</td>

<td align="center">
<img src="https://github.com/Ashhar15.png" width="100px"/><br>
<b>Ashhar15</b><br>
Core Developer
</td>

<td align="center">
<img src="https://github.com/MJ-998201.png" width="100px"/><br>
<b>MJ-99820</b><br>
Experience Designer
</td>

<td align="center">
<img src="https://github.com/naushinanerd-stack.png" width="100px"/><br>
<b>Naushin45</b><br>
Systems Associate
</td>

<td align="center">
<img src="https://github.com/username.png" width="100px"/><br>
<b>Member5</b><br>
Research Analyst
</td>

</tr>
</table>

---

<div align="center">

⬆ [Back to Top](#attendace)

</div>
