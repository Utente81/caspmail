INSERT INTO soc_events (tenant_id, type, severity, source_ip, user_email, message, created_at, raw) VALUES 
('acme-corp', 'DDoS Simulation', 'critical', '104.28.6.194', NULL, 'Massive USA DDoS', NOW(), '{}'), 
('acme-corp', 'Data Exfiltration', 'high', '114.114.58.84', NULL, 'China Data Exfil', NOW() + interval '1 second', '{}');
