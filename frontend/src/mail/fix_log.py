import os
import re

dash_path = '/home/ubuntu/caspmail/new/frontend/src/mail/MailDashboard.jsx'
with open(dash_path, 'r') as f:
    code = f.read()

# Add console.log and onDragEnter
code = code.replace("onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}", 
                    "onDragEnter={(e) => e.preventDefault()}\n                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}")

code = code.replace("const ids = payload.split(',');", 
                    "const ids = payload.split(','); console.log('DROPPED', ids, 'to folder', (typeof item !== 'undefined' ? item.id : (typeof f !== 'undefined' ? f.id : 'unknown')));")

with open(dash_path, 'w') as f:
    f.write(code)

print("Added onDragEnter and console logs")
