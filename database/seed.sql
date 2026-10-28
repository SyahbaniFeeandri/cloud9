-- ============================================
-- FinCloud Database Seed Data
-- ============================================

USE fincloud_db;

-- 1. Roles
INSERT INTO roles (id, name, description) VALUES
(1, 'USER', 'Financial user regular role'),
(2, 'ADMIN', 'System and Cloud Administrator')
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);

-- 2. Income Categories
INSERT INTO categories (type, name, icon, color) VALUES
('income', 'Salary', 'briefcase', '#10b981'),
('income', 'Business', 'trending-up', '#06b6d4'),
('income', 'Investment', 'dollar-sign', '#8b5cf6'),
('income', 'Bonus', 'award', '#f59e0b'),
('income', 'Other', 'plus-circle', '#64748b');

-- 3. Expense Categories
INSERT INTO categories (type, name, icon, color) VALUES
('expense', 'Food', 'utensils', '#f43f5e'),
('expense', 'Transportation', 'car', '#f97316'),
('expense', 'Housing', 'home', '#eab308'),
('expense', 'Education', 'book', '#3b82f6'),
('expense', 'Healthcare', 'activity', '#ec4899'),
('expense', 'Entertainment', 'film', '#a855f7'),
('expense', 'Shopping', 'shopping-bag', '#06b6d4'),
('expense', 'Utilities', 'zap', '#14b8a6'),
('expense', 'Other', 'more-horizontal', '#64748b');

-- 4. Demo Users (Password: password123)
-- Hash generated using bcrypt salt rounds 10: $2a$10$w09ZfxM.5pZ9P7t5gqN5qeqj8pE7V6X3YwE9dM1EaP3M.2E6HlVfa
-- We provide standard users:
-- Regular user: user@fincloud.local / password123
-- Admin user: admin@fincloud.local / password123
INSERT INTO users (id, role_id, name, email, password_hash) VALUES
(1, 1, 'Andi FinCloud', 'user@fincloud.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
(2, 2, 'System Administrator', 'admin@fincloud.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 5. Seed Transactions for Demo
INSERT INTO transactions (id, user_id, category_id, transaction_type, amount, description, transaction_date) VALUES
(1, 1, 1, 'income', 12000000.00, 'Gaji Bulanan Software Engineer Cloud9', CURDATE() - INTERVAL 10 DAY),
(2, 1, 6, 'expense', 1200000.00, 'Belanja Mingguan & Makan Restoran', CURDATE() - INTERVAL 8 DAY),
(3, 1, 7, 'expense', 750000.00, 'Bensin Mobil dan Biaya Tol', CURDATE() - INTERVAL 5 DAY),
(4, 1, 13, 'expense', 500000.00, 'Tagihan Listrik PLN & Internet Rumah', CURDATE() - INTERVAL 3 DAY),
(5, 1, 12, 'expense', 900000.00, 'Beli Kebutuhan Rumah Tangga & Sepatu', CURDATE() - INTERVAL 2 DAY),
(6, 1, 11, 'expense', 400000.00, 'Nonton Bioskop & Langganan Streaming', CURDATE() - INTERVAL 1 DAY)
ON DUPLICATE KEY UPDATE amount=VALUES(amount);

-- 6. Initial Audit Log
INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address) VALUES
(1, 'USER_REGISTER', 'users', 1, 'Initial seed registration user', '127.0.0.1'),
(2, 'USER_REGISTER', 'users', 2, 'Initial seed registration admin', '127.0.0.1'),
(1, 'TRANSACTION_CREATE', 'transactions', 1, 'Seed salary transaction created', '127.0.0.1');
