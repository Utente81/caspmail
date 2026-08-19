with open('MailInbox.jsx', 'r') as f:
    lines = f.readlines()

# Delete lines 71 to 79 (0-indexed 70 to 78)
del lines[70:79]

with open('MailInbox.jsx', 'w') as f:
    f.writelines(lines)
