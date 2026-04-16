-- ============================================
-- TABLE: roles
-- PURPOSE: Store different user roles
-- ============================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles for Smart Approval Workflow Dashboard

INSERT INTO roles (role_name, description) VALUES
('Admin', 'System administrator with full access'),
('Approver', 'User who can approve or reject requests'),
('Employee', 'User who can submit approval requests');
