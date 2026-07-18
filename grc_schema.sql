-- RoPA Records
CREATE TABLE IF NOT EXISTS ropa_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    process_name VARCHAR(255) NOT NULL,
    data_categories TEXT NOT NULL,
    legal_basis VARCHAR(100) NOT NULL,
    retention_period VARCHAR(100) NOT NULL,
    data_subjects TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data Subject Requests
CREATE TABLE IF NOT EXISTS dsr_requests (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    request_type VARCHAR(50) NOT NULL, -- 'export', 'erasure'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vulnerabilities
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id VARCHAR(36) PRIMARY KEY,
    cve_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    cvss_score NUMERIC(3, 1),
    component VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'mitigated', 'resolved'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ITAM Assets
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    hostname VARCHAR(255),
    device_type VARCHAR(100),
    os_info VARCHAR(255),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspicious'
    risk_level VARCHAR(20) DEFAULT 'low',
    UNIQUE(tenant_id, ip_address)
);

-- Security Policies
CREATE TABLE IF NOT EXISTS security_policies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    version VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy Acknowledgments
CREATE TABLE IF NOT EXISTS policy_acknowledgments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    policy_id VARCHAR(36) NOT NULL REFERENCES security_policies(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    UNIQUE(policy_id, user_email)
);
