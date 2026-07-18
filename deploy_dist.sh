#!/bin/bash
cd /home/ubuntu/caspmail/new/frontend/dist
tar -czf ../dist.tar.gz .
cd ..
for pod in $(kubectl get pods -n caspermail -l app=frontend -o jsonpath='{.items[*].metadata.name}'); do
  echo "Updating $pod"
  kubectl cp dist.tar.gz caspermail/$pod:/tmp/dist.tar.gz
  kubectl exec -n caspermail $pod -- sh -c 'tar -xzf /tmp/dist.tar.gz -C /usr/share/nginx/html'
done
echo "Done"
