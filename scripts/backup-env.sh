#!/bin/bash

# Environment Backup Script for Railway Deployment
# Creates timestamped backups of environment files

set -e

# Configuration
BACKUP_DIR="./backup"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="env-backup-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Starting environment backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create timestamped backup directory
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
mkdir -p "${BACKUP_PATH}"

# Backup environment files
if [ -f ".env" ]; then
    cp .env "${BACKUP_PATH}/.env"
    echo -e "${GREEN}✅ Backed up .env${NC}"
else
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
fi

if [ -f ".env.local" ]; then
    cp .env.local "${BACKUP_PATH}/.env.local"
    echo -e "${GREEN}✅ Backed up .env.local${NC}"
else
    echo -e "${YELLOW}⚠️  No .env.local file found${NC}"
fi

if [ -f ".env.production" ]; then
    cp .env.production "${BACKUP_PATH}/.env.production"
    echo -e "${GREEN}✅ Backed up .env.production${NC}"
else
    echo -e "${YELLOW}⚠️  No .env.production file found${NC}"
fi

# Backup configuration files
if [ -f "railway.toml" ]; then
    cp railway.toml "${BACKUP_PATH}/railway.toml"
    echo -e "${GREEN}✅ Backed up railway.toml${NC}"
fi

if [ -f "vite.config.js" ]; then
    cp vite.config.js "${BACKUP_PATH}/vite.config.js"
    echo -e "${GREEN}✅ Backed up vite.config.js${NC}"
fi

if [ -f "package.json" ]; then
    cp package.json "${BACKUP_PATH}/package.json"
    echo -e "${GREEN}✅ Backed up package.json${NC}"
fi

# Create backup manifest
cat > "${BACKUP_PATH}/backup-manifest.txt" << EOF
Environment Backup Manifest
==========================
Backup Date: $(date)
Backup Path: ${BACKUP_PATH}
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "Not in git repository")
Git Branch: $(git branch --show-current 2>/dev/null || echo "Not in git repository")

Files Backed Up:
$(ls -la "${BACKUP_PATH}" | grep -v "backup-manifest.txt")

Environment Variables (without values):
$(grep -E '^[A-Z_]+=|^VITE_[A-Z_]+=' .env 2>/dev/null | sed 's/=.*/=***REDACTED***/' || echo "No .env file found")

Notes:
- Sensitive values have been redacted from this manifest
- Original files contain actual environment variable values
- This backup can be used for rollback procedures
EOF

echo -e "${GREEN}📋 Created backup manifest${NC}"

# Compress backup if requested
if [ "$1" = "--compress" ]; then
    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
    rm -rf "${BACKUP_NAME}"
    echo -e "${GREEN}🗜️  Compressed backup to ${BACKUP_NAME}.tar.gz${NC}"
    cd ..
fi

echo -e "${GREEN}✅ Environment backup completed successfully!${NC}"
echo -e "${YELLOW}📁 Backup location: ${BACKUP_PATH}${NC}"

# Clean up old backups (keep last 10)
find "${BACKUP_DIR}" -name "env-backup-*" -type d | sort | head -n -10 | xargs rm -rf 2>/dev/null || true
find "${BACKUP_DIR}" -name "env-backup-*.tar.gz" | sort | head -n -10 | xargs rm -f 2>/dev/null || true

echo -e "${GREEN}🧹 Cleaned up old backups (keeping last 10)${NC}"