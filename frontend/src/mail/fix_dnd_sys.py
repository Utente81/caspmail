import re

with open('/home/ubuntu/caspmail/new/frontend/src/mail/MailDashboard.jsx', 'r') as f:
    code = f.read()

# We need to replace the logic inside the system folders onDrop:
pattern = r"let p;\s+if \(item\.id === 'trash'\) \{\s+p = fetch\('/api/e2ee/messages/bulk/trash', \{\s+method: 'PATCH',\s+headers: \{ 'Content-Type': 'application/json', Authorization: `Bearer \$\{token\}` \},\s+body: JSON\.stringify\(\{ ids \}\)\s+\}\);\s+\} else \{\s+p = fetch\('/api/e2ee/messages/bulk/flags', \{\s+method: 'PATCH',\s+headers: \{ 'Content-Type': 'application/json', Authorization: `Bearer \$\{token\}` \},\s+body: JSON\.stringify\(\{ ids, flags: \{ folder_id: item\.id \} \}\)\s+\}\);\s+\}\s+p\.then\(\(\) => setRefreshTrigger\(t => t \+ 1\)\);"

new_code = """
                  if (item.id === 'trash') {
                    fetch('/api/e2ee/messages/bulk/trash', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ ids })
                    }).then(() => setRefreshTrigger(t => t + 1));
                  } else {
                    let flags = {};
                    if (item.id === 'inbox') {
                        flags = { archived: false, spam: false, folder_id: null };
                    } else if (item.id === 'archive') {
                        flags = { archived: true, spam: false, folder_id: null };
                    } else if (item.id === 'spam') {
                        flags = { spam: true, archived: false, folder_id: null };
                    } else if (item.id === 'important') {
                        flags = { important: true };
                    }
                    fetch('/api/e2ee/messages/bulk/flags', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ ids, flags })
                    }).then(() => setRefreshTrigger(t => t + 1));
                  }
"""

code = re.sub(pattern, new_code.strip(), code)

with open('/home/ubuntu/caspmail/new/frontend/src/mail/MailDashboard.jsx', 'w') as f:
    f.write(code)
