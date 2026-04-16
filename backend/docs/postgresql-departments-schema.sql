-- ============================================
-- TABLE: departments
-- PURPOSE: Store organization departments
-- ============================================

CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default departments

INSERT INTO departments (department_name, description) VALUES
('Human Resources', 'Handles employee management and policies'),
('Finance', 'Handles financial approvals and budgeting'),
('IT', 'Handles technical and system related requests'),
('Operations', 'Handles operational approvals and logistics');
