#!/bin/bash
set -e
cd /home/ubuntu/caspmail/new/backend
docker build --no-cache -t caspermail-backend:v2 .
kubectl apply -f ../k8s/backend.yaml
kubectl rollout restart deployment casper-backend -n caspermail
echo "Done"
