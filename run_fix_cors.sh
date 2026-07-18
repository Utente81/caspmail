#!/bin/bash
POD=$(kubectl get pods -n caspermail -l app=backend -o jsonpath='{.items[0].metadata.name}')
kubectl cp /home/ubuntu/caspmail/new/fix_cors.mjs caspermail/$POD:/tmp/fix_cors.mjs
kubectl exec -n caspermail $POD -- node /tmp/fix_cors.mjs
