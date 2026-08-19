with open('verify.mjs', 'r') as f:
    lines = f.readlines()
with open('verify.mjs', 'w') as f:
    for line in lines:
        if 'message: \Required role' in line or 'message:' in line and '\\\\' in line:
            f.write('        message: \Required role(s): \\\,\n')
        else:
            f.write(line)
