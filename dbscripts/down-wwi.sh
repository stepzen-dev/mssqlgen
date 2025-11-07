#!/usr/bin/env bash
set -euo pipefail
CONTAINER_NAME="${CONTAINER_NAME:-mssql-wwi}"
DELETE_BAK="${DELETE_BAK:-false}"  # set DELETE_BAK=true to remove the local .bak

echo "=> Stopping and removing $CONTAINER_NAME ..."
podman rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

if [ "${DELETE_BAK}" = "true" ]; then
  echo "=> Deleting local WideWorldImporters-Standard.bak ..."
  rm -f ./WideWorldImporters-Standard.bak
fi

echo "=> Done."

