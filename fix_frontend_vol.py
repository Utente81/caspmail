import yaml

with open('/home/ubuntu/caspmail/new/k8s/frontend.yaml', 'r') as f:
    docs = list(yaml.safe_load_all(f))

for doc in docs:
    if doc.get('kind') == 'Deployment' and doc['metadata']['name'] == 'casper-frontend':
        containers = doc['spec']['template']['spec']['containers']
        for c in containers:
            if 'volumeMounts' in c:
                c['volumeMounts'] = [vm for vm in c['volumeMounts'] if vm['name'] != 'html-volume']
        
        volumes = doc['spec']['template']['spec'].get('volumes', [])
        doc['spec']['template']['spec']['volumes'] = [v for v in volumes if v['name'] != 'html-volume']

with open('/home/ubuntu/caspmail/new/k8s/frontend.yaml', 'w') as f:
    yaml.dump_all(docs, f, default_flow_style=False, sort_keys=False)

print('Fixed frontend.yaml')
