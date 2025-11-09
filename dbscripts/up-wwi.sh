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

# --- Settings you might tweak ---
CONTAINER_NAME="mssql-wwi"
SA_PASSWORD="${SA_PASSWORD:-Str0ng!Passw0rd}"   # override by exporting SA_PASSWORD
MSSQL_IMAGE="mcr.microsoft.com/mssql/server:2022-latest"
MSSQL_PID="Developer"                            # or Express
HOST_PORT="${HOST_PORT:-1433}"                   # override by exporting HOST_PORT
BAK_LOCAL="./WideWorldImporters-Standard.bak"
BAK_URL="https://github.com/Microsoft/sql-server-samples/releases/download/wide-world-importers-v1.0/WideWorldImporters-Standard.bak"
TOOLS="/opt/mssql-tools18/bin/sqlcmd"

echo "=> Cleaning any prior container..."
$CONTAINER_CMD rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "=> Pulling image $MSSQL_IMAGE ..."
$CONTAINER_CMD pull "$MSSQL_IMAGE" >/dev/null

echo "=> Starting SQL Server container ($CONTAINER_NAME) on port $HOST_PORT ..."
$CONTAINER_CMD run -d --name "$CONTAINER_NAME" \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=$SA_PASSWORD" \
  -e "MSSQL_PID=$MSSQL_PID" \
  -p "$HOST_PORT:1433" \
  "$MSSQL_IMAGE" >/dev/null

# Wait for SQL to accept connections
echo -n "=> Waiting for SQL Server to be ready"
for i in {1..60}; do
  if $CONTAINER_CMD exec "$CONTAINER_NAME" $TOOLS -S localhost -U sa -P "$SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    echo -e "\n=> SQL Server is ready."
    break
  fi
  echo -n "."
  sleep 2
done

# Grab the sample backup if not present
if [ ! -f "$BAK_LOCAL" ]; then
  echo "=> Downloading Wide World Importers backup (~100–200MB) ..."
  curl -L -o "$BAK_LOCAL" "$BAK_URL"
else
  echo "=> Reusing existing $BAK_LOCAL"
fi

echo "=> Copying backup into container ..."
$CONTAINER_CMD exec "$CONTAINER_NAME" bash -lc "mkdir -p /var/opt/mssql/backup"
$CONTAINER_CMD cp "$BAK_LOCAL" "$CONTAINER_NAME:/var/opt/mssql/backup/wwi.bak"

echo "=> Discovering logical file names (RESTORE FILELISTONLY) ..."
$CONTAINER_CMD exec "$CONTAINER_NAME" $TOOLS -S localhost -U sa -P "$SA_PASSWORD" -C \
  -Q 'RESTORE FILELISTONLY FROM DISK = "/var/opt/mssql/backup/wwi.bak"'

# Typical logical names for WWI (covers Full/Standard builds):
#   WWI_Primary, WWI_UserData, WWI_Log, WWI_InMemory_Data_1
# We'll attempt a restore with those names.
echo "=> Restoring database WideWorldImporters ..."
$CONTAINER_CMD exec "$CONTAINER_NAME" $TOOLS -S localhost -U sa -P "$SA_PASSWORD" -C -Q "
RESTORE DATABASE WideWorldImporters
FROM DISK = '/var/opt/mssql/backup/wwi.bak'
WITH MOVE 'WWI_Primary'          TO '/var/opt/mssql/data/WideWorldImporters.mdf',
     MOVE 'WWI_UserData'         TO '/var/opt/mssql/data/WideWorldImporters_UserData.ndf',
     MOVE 'WWI_Log'              TO '/var/opt/mssql/data/WideWorldImporters.ldf',
     REPLACE, RECOVERY, STATS = 5;
" || {
  echo "!! Restore failed, likely due to differing logical file names."
  echo "   Run FILELISTONLY above and adjust the MOVE names accordingly."
  exit 1
}

echo "=> Done."
echo
echo "Connect from your Fedora host using a standard connection string:"
echo "  ADO.NET : Server=127.0.0.1,${HOST_PORT};Database=WideWorldImporters;User Id=sa;Password=${SA_PASSWORD};TrustServerCertificate=True;"
echo "  ODBC    : Driver={ODBC Driver 18 for SQL Server};Server=127.0.0.1,${HOST_PORT};Database=WideWorldImporters;Uid=sa;Pwd=${SA_PASSWORD};TrustServerCertificate=Yes;"
echo "  JDBC    : jdbc:sqlserver://127.0.0.1:${HOST_PORT};databaseName=WideWorldImporters;encrypt=true;trustServerCertificate=true;user=sa;password=${SA_PASSWORD};"

