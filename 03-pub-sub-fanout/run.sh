#!/usr/bin/env bash
# Usage: ./run.sh EmitLog "error: disk full"   |   ./run.sh ReceiveLogs screen
set -e
cd "$(dirname "$0")"
mvn -q compile dependency:build-classpath -Dmdep.outputFile=cp.txt
main="$1"; shift
exec java -cp "target/classes:$(cat cp.txt)" "practice.$main" "$@"
