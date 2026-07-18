#!/bin/bash
set -e
cd /home/ubuntu/caspmail/new/frontend
docker build --no-cache -t caspermail-frontend:latest .
kubectl apply -f /tmp/patch_frontend_cm.yaml
kubectl apply -f ../k8s/frontend.yaml
kubectl rollout restart deployment casper-frontend -n caspermail
echo "Frontend deployed"
