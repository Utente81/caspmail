import re

with open('/home/ubuntu/caspmail/new/backend/src/routes/mail.mjs', 'r') as f:
    code = f.read()

# Fix the inbox query to exclude folder_id
inbox_regex = r"(if \(folder === 'inbox'\) \{[^}]+)(AND COALESCE\(\(recipient_flags->>'archived'\)::boolean, false\) = false)(`;\s*\})"
inbox_replacement = r"\1\2 AND recipient_flags->>'folder_id' IS NULL\3"
code = re.sub(inbox_regex, inbox_replacement, code)

# Fix the sent query to exclude folder_id
sent_regex = r"(else if \(folder === 'sent'\) \{[^}]+)(AND sender_deleted_at IS NULL)(`;\s*\})"
sent_replacement = r"\1\2 AND sender_flags->>'folder_id' IS NULL\3"
code = re.sub(sent_regex, sent_replacement, code)

with open('/home/ubuntu/caspmail/new/backend/src/routes/mail.mjs', 'w') as f:
    f.write(code)
