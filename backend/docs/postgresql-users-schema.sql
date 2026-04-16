-- ============================================
-- TABLE: users
-- PURPOSE: Store all system users
-- ============================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_role
        FOREIGN KEY(role_id) 
        REFERENCES roles(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_department
        FOREIGN KEY(department_id)
        REFERENCES departments(id)
        ON DELETE RESTRICT
);
