import os
import re

dash_path = '/home/ubuntu/caspmail/new/frontend/src/mail/MailDashboard.jsx'
with open(dash_path, 'r') as f:
    dashboard_code = f.read()

dash_replacement1 = '''onClick={() => setActive(item.id)}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  const payload = e.dataTransfer.getData('text/plain');
                  if (!payload) return;
                  const ids = payload.split(',');
                  const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token');
                  let p;
                  if (item.id === 'trash') {
                    p = fetch('/api/e2ee/messages/bulk/trash', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ ids })
                    });
                  } else {
                    p = fetch('/api/e2ee/messages/bulk/flags', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ ids, flags: { folder_id: item.id } })
                    });
                  }
                  p.then(() => setRefreshTrigger(t => t + 1));
                }}
              >'''

dashboard_code = re.sub(r'onClick=\{\(\) => setActive\(item\.id\)\}\s+>', dash_replacement1, dashboard_code)

with open(dash_path, 'w') as f:
    f.write(dashboard_code)

print("Fixed MailDashboard.jsx for main NAV")
