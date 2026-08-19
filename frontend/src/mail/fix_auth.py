import os
import re

dash_path = '/home/ubuntu/caspmail/new/frontend/src/mail/MailDashboard.jsx'
with open(dash_path, 'r') as f:
    dashboard_code = f.read()

# Fix the broken Authorization header in MailDashboard.jsx
# We find exactly "Authorization: Bearer }" and replace it with "Authorization: `Bearer ${token}` }"
dashboard_code = dashboard_code.replace("Authorization: Bearer },", "Authorization: `Bearer ${token}` },")

with open(dash_path, 'w') as f:
    f.write(dashboard_code)

print("Fixed MailDashboard.jsx")
