INSERT INTO web_origins (client_id, value)
SELECT id, 'https://soc.secure.internal' FROM client WHERE client_id='caspermail-soc' ON CONFLICT DO NOTHING;
INSERT INTO web_origins (client_id, value)
SELECT id, 'https://secure.internal' FROM client WHERE client_id='caspermail-soc' ON CONFLICT DO NOTHING;
INSERT INTO web_origins (client_id, value)
SELECT id, 'https://secure.internal' FROM client WHERE client_id='caspmail-frontend' ON CONFLICT DO NOTHING;
INSERT INTO web_origins (client_id, value)
SELECT id, 'https://soc.secure.internal' FROM client WHERE client_id='caspmail-frontend' ON CONFLICT DO NOTHING;
