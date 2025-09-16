#!/bin/bash

# Repository Backup Script for Railway Deployment
# Creates complete repository backup for rollback purposes

set -e

# Configuration
BACKUP_DIR="./backup"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PROJECT_NAME="job_tracker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Starting repository backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Get current git information
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
CURRENT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "no-tag")

echo -e "${BLUE}📊 Repository Information:${NC}"
echo -e "  Branch: ${CURRENT_BRANCH}"
echo -e "  Commit: ${CURRENT_COMMIT}"
echo -e "  Tag: ${CURRENT_TAG}"

# Create repository archive
ARCHIVE_NAME="${PROJECT_NAME}-backup-${TIMESTAMP}"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"

echo -e "${GREEN}📦 Creating repository archive...${NC}"

# Create git archive (excludes ignored files automatically)
git archive --format=zip --prefix="${PROJECT_NAME}/" --output="${ARCHIVE_PATH}.zip" HEAD

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Repository archive created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create repository archive${NC}"
    exit 1
fi

# Create backup metadata
cat > "${BACKUP_DIR}/${ARCHIVE_NAME}-metadata.txt" << EOF
Repository Backup Metadata
=========================
Backup Date: $(date)
Project: ${PROJECT_NAME}
Archive: ${ARCHIVE_NAME}.zip

Git Information:
- Branch: ${CURRENT_BRANCH}
- Commit: ${CURRENT_COMMIT}
- Tag: ${CURRENT_TAG}
- Remote URL: $(git remote get-url origin 2>/dev/null || echo "No remote configured")

Repository Stats:
- Total commits: $(git rev-list --all --count 2>/dev/null || echo "Unknown")
- Contributors: $(git shortlog -sn --all | wc -l 2>/dev/null || echo "Unknown")
- Last commit date: $(git log -1 --format=%cd 2>/dev/null || echo "Unknown")

Archive Contents:
$(unzip -l "${ARCHIVE_PATH}.zip" 2>/dev/null | head -20 || echo "Could not list archive contents")

Rollback Instructions:
1. Extract archive: unzip ${ARCHIVE_NAME}.zip
2. Navigate to project: cd ${PROJECT_NAME}
3. Install dependencies: npm install
4. Restore environment: Use backup from backup-env.sh
5. Test locally: npm run dev

Notes:
- This backup excludes node_modules and build artifacts
- Environment files are backed up separately
- Use this backup for complete project restoration
EOF

echo -e "${GREEN}📋 Created backup metadata${NC}"

# Calculate archive size
ARCHIVE_SIZE=$(du -h "${ARCHIVE_PATH}.zip" | cut -f1)
echo -e "${BLUE}📏 Archive size: ${ARCHIVE_SIZE}${NC}"

# Create deployment tag if not exists
DEPLOY_TAG="v1.0.0-pre-railway-${TIMESTAMP}"
if [ "$1" = "--tag" ]; then
    echo -e "${GREEN}🏷️  Creating deployment tag: ${DEPLOY_TAG}${NC}"
    git tag -a "${DEPLOY_TAG}" -m "Pre-Railway deployment backup - ${TIMESTAMP}"
    echo -e "${GREEN}✅ Tag created successfully${NC}"
    echo -e "${YELLOW}💡 Push tag with: git push origin ${DEPLOY_TAG}${NC}"
fi

# Clean up old backups (keep last 5 repository backups)
echo -e "${GREEN}🧹 Cleaning up old repository backups...${NC}"
find "${BACKUP_DIR}" -name "${PROJECT_NAME}-backup-*.zip" | sort | head -n -5 | xargs rm -f 2>/dev/null || true
find "${BACKUP_DIR}" -name "${PROJECT_NAME}-backup-*-metadata.txt" | sort | head -n -5 | xargs rm -f 2>/dev/null || true

echo -e "${GREEN}✅ Repository backup completed successfully!${NC}"
echo -e "${YELLOW}📁 Archive location: ${ARCHIVE_PATH}.zip${NC}"
echo -e "${YELLOW}📄 Metadata: ${BACKUP_DIR}/${ARCHIVE_NAME}-metadata.txt${NC}"

# Verification
if [ -f "${ARCHIVE_PATH}.zip" ]; then
    echo -e "${GREEN}🔍 Backup verification: PASSED${NC}"
else
    echo -e "${RED}❌ Backup verification: FAILED${NC}"
    exit 1
fi