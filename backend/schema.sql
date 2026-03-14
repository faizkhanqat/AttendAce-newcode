-- -----------------------------------------------------
-- AttendAce Consolidated Schema
-- -----------------------------------------------------

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher') NOT NULL,
    mode ENUM('official', 'gaming') NOT NULL DEFAULT 'official',
    face_encoding TEXT,
    face_updated_at DATETIME NULL,
    gender ENUM('male', 'female') NULL,
    dob DATE NULL,
    department VARCHAR(100) NULL,
    aviation_id VARCHAR(20) UNIQUE NULL,
    phone VARCHAR(20) NULL,
    otp_code VARCHAR(10) NULL,
    otp_expires DATETIME NULL,
    reg_otp_code VARCHAR(10) NULL,
    reg_otp_expires DATETIME NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) DEFAULT '',
    total_classes INT DEFAULT 0,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE active_classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    teacher_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    conducted_on DATE NULL,
    UNIQUE KEY unique_active_class (class_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    qr_token VARCHAR(255) NULL,
    face_match BOOLEAN DEFAULT FALSE,
    status ENUM('present', 'absent', 'pending') DEFAULT 'pending',
    method ENUM('qr', 'manual', 'gps', 'face') DEFAULT 'qr',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    conducted_on DATE NOT NULL,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    INDEX idx_student_class (student_id, class_id),
    UNIQUE KEY unique_student_session (student_id, class_id, conducted_on)
);

CREATE TABLE student_classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_enrollment (student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Summary Tables
CREATE TABLE student_attendance_summary (
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    total_classes INT DEFAULT 0,
    attended_count INT DEFAULT 0,
    PRIMARY KEY(student_id, class_id),
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);