with open('MailInbox.jsx', 'r') as f:
    lines = f.readlines()

lines.insert(70, '        >\n')

with open('MailInbox.jsx', 'w') as f:
    f.writelines(lines)
