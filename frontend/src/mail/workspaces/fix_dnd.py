import os
import re

inbox_path = '/home/ubuntu/caspmail/new/frontend/src/mail/workspaces/MailInbox.jsx'
with open(inbox_path, 'r') as f:
    inbox_code = f.read()

replacement = '''onClick={() => onSelect(msg)}
          draggable={true}
          onDragStart={(e) => {
            if (checkedIds.has(msg.id)) {
              e.dataTransfer.setData('text/plain', Array.from(checkedIds).join(','));
            } else {
              e.dataTransfer.setData('text/plain', msg.id);
            }
            e.dataTransfer.effectAllowed = 'move';
          }}
        >'''

inbox_code = re.sub(r'onClick=\{\(\) => onSelect\(msg\)\}\s+draggable=" true onDragStart=.*?>', replacement, inbox_code, flags=re.DOTALL)

with open(inbox_path, 'w') as f:
    f.write(inbox_code)

print("Fixed MailInbox.jsx")
