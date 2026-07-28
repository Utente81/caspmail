-- 015_compliance_fase3.sql
-- Table for Data Processing Agreements (Contract Manager)
CREATE TABLE IF NOT EXISTS dpa_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    vendor_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, expired, pending
    signed_at TIMESTAMP,
    expiry_date TIMESTAMP,
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dpa_agreements_tenant ON dpa_agreements(tenant_id);

-- Table for Security Training & Awareness
CREATE TABLE IF NOT EXISTS security_trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    user_email VARCHAR(255) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed
    score INTEGER,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_trainings_tenant ON security_trainings(tenant_id);

-- Table for Physical Access Logs
CREATE TABLE IF NOT EXISTS physical_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    user_email VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    action VARCHAR(50) DEFAULT 'entry', -- entry, exit
    reader_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_physical_access_logs_tenant ON physical_access_logs(tenant_id);
