import os

inbox_path = '/home/ubuntu/caspmail/new/frontend/src/mail/workspaces/MailInbox.jsx'
with open(inbox_path, 'r') as f:
    inbox_code = f.read()

inbox_code = inbox_code.replace("e.dataTransfer.setData('text/plain', msg.id);", "e.dataTransfer.setData('text/plain', String(msg.id));")

with open(inbox_path, 'w') as f:
    f.write(inbox_code)

print("Fixed MailInbox.jsx msg.id")
