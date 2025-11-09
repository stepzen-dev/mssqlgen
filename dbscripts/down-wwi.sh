#!/usr/bin/env bash
set -euo pipefail

# --- Detect container runtime (podman or docker) ---
if command -v podman &> /dev/null; then
  CONTAINER_CMD="podman"
elif command -v docker &> /dev/null; then
  CONTAINER_CMD="docker"
else
  echo "ERROR: Neither podman nor docker found. Please install one of them."
  exit 1
fi
echo "=> Using container runtime: $CONTAINER_CMD"

CONTAINER_NAME="${CONTAINER_NAME:-mssql-wwi}"
DELETE_BAK="${DELETE_BAK:-false}"  # set DELETE_BAK=true to remove the local .bak

echo "=> Stopping and removing $CONTAINER_NAME ..."
$CONTAINER_CMD rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

if [ "${DELETE_BAK}" = "true" ]; then
  echo "=> Deleting local WideWorldImporters-Standard.bak ..."
  rm -f ./WideWorldImporters-Standard.bak
fi

echo "=> Done."

