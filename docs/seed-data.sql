-- Roles
INSERT INTO roles (name, description) VALUES
('USER', 'Financial user'),
('ADMIN', 'Administrator');

-- Categories Income
INSERT INTO categories (type, name) VALUES
('income', 'Salary'),
('income', 'Business'),
('income', 'Investment'),
('income', 'Bonus'),
('income', 'Other');

-- Categories Expense
INSERT INTO categories (type, name) VALUES
('expense', 'Food'),
('expense', 'Transportation'),
('expense', 'Housing'),
('expense', 'Education'),
('expense', 'Healthcare'),
('expense', 'Entertainment'),
('expense', 'Shopping'),
('expense', 'Utilities'),
('expense', 'Other');

-- Demo Users (password: password)
-- Hash: $2b$12$...
INSERT INTO users (role_id, name, email, password_hash) VALUES
(1, 'Demo User', 'user@fincloud.local', '<bcrypt hash>'),
(2, 'Admin', 'admin@fincloud.local', '<bcrypt hash>');
