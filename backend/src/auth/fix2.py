import urllib.parse
with open('verify.mjs', 'r') as f:
    lines = f.readlines()
with open('verify.mjs', 'w') as f:
    for line in lines:
        if 'Required role(s)' in line:
            f.write(urllib.parse.unquote('        message: %60Required%20role%28s%29%3A%20%24%7Broles.join%28%27%2C%20%27%29%7D%60%2C%0A'))
        else:
            f.write(line)
