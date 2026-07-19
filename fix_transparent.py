import re

with open('/home/ubuntu/caspmail/new/keycloak-theme/themes/caspmail/login/resources/css/caspmail-login-v14.css', 'r') as f:
    content = f.read()

new_card = '''.card-pf {
  width: 100% !important;
  max-width: 420px !important;
  margin: 0 !important;
  background: transparent !important;
  border: none !important;
  padding: 48px 40px !important;
  box-shadow: none !important;
  color: #e2e8f0 !important; 
  position: relative;
  z-index: 20 !important;
}'''

content = re.sub(r'\.card-pf\s*\{[^}]+\}', new_card, content)

with open('/home/ubuntu/caspmail/new/keycloak-theme/themes/caspmail/login/resources/css/caspmail-login-v14.css', 'w') as f:
    f.write(content)
