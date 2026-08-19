import re

with open('/home/ubuntu/caspmail/new/frontend/src/mail/MailDashboard.jsx', 'r') as f:
    code = f.read()

new_system_drop = """                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  const payload = e.dataTransfer.getData('text/plain');
                  if (!payload) return;
                  const ids = payload.split(',');
                  const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token');
                  
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
                }}"""

new_custom_drop = """                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  const payload = e.dataTransfer.getData('text/plain');
                  if (!payload) return;
                  const ids = payload.split(',');
                  const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token');
                  
                  fetch('/api/e2ee/messages/bulk/flags', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ ids, flags: { folder_id: f.id, archived: false, spam: false } })
                  }).then(() => setRefreshTrigger(t => t + 1));
                }}"""

code = re.sub(r'onDrop=\{\(e\) => \{\s+e\.preventDefault\(\);\s+e\.currentTarget\.classList\.remove\(\'drag-over\'\);\s+const payload = e\.dataTransfer\.getData\(\'text/plain\'\);\s+if \(!payload\) return;\s+const ids = payload\.split\(\',\'\);[^\n]*\n\s+const token = sessionStorage\.getItem\(\'caspmail_access_token\'\) \|\| localStorage\.getItem\(\'caspmail_access_token\'\);\s+let p;\s+if \(item\.id === \'trash\'\) \{[^\}]+\}\s+\}\s+else\s+\{[^\}]+\}\s+\}\s+p\.then\(\(\) => setRefreshTrigger\(t => t \+ 1\)\);\s+\}\}', new_system_drop.strip(), code)

code = re.sub(r'onDrop=\{\(e\) => \{\s+e\.preventDefault\(\);\s+e\.currentTarget\.classList\.remove\(\'drag-over\'\);\s+const payload = e\.dataTransfer\.getData\(\'text/plain\'\);\s+if \(!payload\) return;\s+const ids = payload\.split\(\',\'\);[^\n]*\n\s+const token = sessionStorage\.getItem\(\'caspmail_access_token\'\) \|\| localStorage\.getItem\(\'caspmail_access_token\'\);\s+fetch\(\'/api/e2ee/messages/bulk/flags\', \{[^;]+;\s+\}\}', new_custom_drop.strip(), code)

with open('/home/ubuntu/caspmail/new/frontend/src/mail/MailDashboard.jsx', 'w') as f:
    f.write(code)
