import os

inbox_path = 'workspaces/MailInbox.jsx'
with open(inbox_path, 'r') as f:
    inbox_code = f.read()

inbox_target = '''onClick={() => onSelect(msg)}
        >'''

inbox_replacement = '''onClick={() => onSelect(msg)}
          draggable=" true\
 onDragStart={(e) => {
 if (checkedIds.has(msg.id)) {
 e.dataTransfer.setData('text/plain', Array.from(checkedIds).join(','));
 } else {
 e.dataTransfer.setData('text/plain', msg.id);
 }
 e.dataTransfer.effectAllowed = 'move';
 }}
 >'''

inbox_code = inbox_code.replace(inbox_target, inbox_replacement)

with open(inbox_path, 'w') as f:
 f.write(inbox_code)


dashboard_path = 'MailDashboard.jsx'
with open(dashboard_path, 'r') as f:
 dashboard_code = f.read()

dash_target1 = '''onClick={() => setActive(item.id)}
 >'''

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
 headers: { 'Content-Type': 'application/json', Authorization: Bearer },
 body: JSON.stringify({ ids })
 });
 } else {
 p = fetch('/api/e2ee/messages/bulk/flags', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json', Authorization: Bearer },
 body: JSON.stringify({ ids, flags: { folder_id: item.id } })
 });
 }
 p.then(() => setRefreshTrigger(t => t + 1));
 }}
 >'''

dash_target2 = '''onClick={() => setActive(f.id)}>'''

dash_replacement2 = '''onClick={() => setActive(f.id)}
 onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
 onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
 onDrop={(e) => {
 e.preventDefault();
 e.currentTarget.classList.remove('drag-over');
 const payload = e.dataTransfer.getData('text/plain');
 if (!payload) return;
 const ids = payload.split(',');
 const token = sessionStorage.getItem('caspmail_access_token') || localStorage.getItem('caspmail_access_token');
 
 fetch('/api/e2ee/messages/bulk/flags', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json', Authorization: Bearer },
 body: JSON.stringify({ ids, flags: { folder_id: f.id } })
 }).then(() => setRefreshTrigger(t => t + 1));
 }}
 >'''

dashboard_code = dashboard_code.replace(dash_target1, dash_replacement1)
dashboard_code = dashboard_code.replace(dash_target2, dash_replacement2)

with open(dashboard_path, 'w') as f:
 f.write(dashboard_code)

print('Patched successfully')
