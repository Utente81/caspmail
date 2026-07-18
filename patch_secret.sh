#!/bin/bash
set -e
MINIO_PASS=$(cat /opt/caspermail/runtime-secrets/minio_root_password)
kubectl patch secret casper-secrets -n caspermail -p "{\"stringData\":{\"minio_root_user\":\"admin\", \"minio_root_password\":\"${MINIO_PASS}\"}}"
