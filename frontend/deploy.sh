#!/bin/bash
cd /home/ubuntu/caspmail/new/frontend
POD=$(kubectl get pod -l app=frontend -n caspermail -o jsonpath='{.items[0].metadata.name}')
kubectl cp dist caspermail/$POD:/usr/share/nginx/html
