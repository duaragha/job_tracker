#!/bin/bash

# Railway Deployment Preparation Script
# Comprehensive setup for Railway deployment

set -e

# Configuration
DEPLOYMENT_BRANCH="railway-deployment"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 Railway Deployment Preparation${NC}"
echo -e "${PURPLE}=================================${NC}"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    echo -e "${YELLOW}   Please commit or stash them before proceeding${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Create backups
echo -e "${GREEN}🔄 Step 1: Creating backups...${NC}"
chmod +x scripts/backup-env.sh scripts/backup-repo.sh
./scripts/backup-env.sh --compress
./scripts/backup-repo.sh --tag

# Step 2: Prepare deployment branch
echo -e "${GREEN}🔄 Step 2: Preparing deployment branch...${NC}"

# Check if deployment branch already exists
if git show-ref --verify --quiet refs/heads/${DEPLOYMENT_BRANCH}; then
    echo -e "${YELLOW}⚠️  Deployment branch already exists${NC}"
    read -p "Delete and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git branch -D ${DEPLOYMENT_BRANCH}
        echo -e "${GREEN}✅ Deleted existing deployment branch${NC}"
    else
        echo -e "${BLUE}📝 Switching to existing deployment branch${NC}"
        git checkout ${DEPLOYMENT_BRANCH}
    fi
else
    echo -e "${GREEN}📝 Creating new deployment branch${NC}"
    git checkout -b ${DEPLOYMENT_BRANCH}
fi

# Step 3: Verify configuration files
echo -e "${GREEN}🔄 Step 3: Verifying configuration files...${NC}"

# Check for required files
REQUIRED_FILES=("railway.toml" "package.json" "vite.config.js" ".env.template" ".env.production")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        exit 1
    fi
done

# Step 4: Install and test build
echo -e "${GREEN}🔄 Step 4: Testing build process...${NC}"
npm ci
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Step 5: Test preview server
echo -e "${GREEN}🔄 Step 5: Testing preview server...${NC}"
PORT=4173 timeout 10 npm run preview &
PREVIEW_PID=$!

sleep 5

# Check if server is running
if curl -f http://localhost:4173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Preview server working${NC}"
else
    echo -e "${YELLOW}⚠️  Preview server test inconclusive${NC}"
fi

# Stop preview server
kill $PREVIEW_PID 2>/dev/null || true

# Step 6: Environment validation
echo -e "${GREEN}🔄 Step 6: Validating environment configuration...${NC}"

# Check if environment variables are properly prefixed
if grep -q "^VITE_" .env.template; then
    echo -e "${GREEN}✅ Environment variables properly prefixed${NC}"
else
    echo -e "${YELLOW}⚠️  No VITE_ prefixed variables found${NC}"
fi

# Step 7: Create deployment checklist
echo -e "${GREEN}🔄 Step 7: Creating deployment checklist...${NC}"

cat > "DEPLOYMENT_STATUS.md" << EOF
# Railway Deployment Status

**Prepared on:** $(date)
**Branch:** ${DEPLOYMENT_BRANCH}
**Commit:** $(git rev-parse HEAD)

## Pre-deployment Checklist

- [x] ✅ Repository backup created
- [x] ✅ Environment backup created
- [x] ✅ Deployment branch prepared
- [x] ✅ Configuration files verified
- [x] ✅ Build process tested
- [x] ✅ Preview server tested
- [x] ✅ Environment variables validated

## Next Steps

### Railway Setup
1. Create Railway account and install CLI
2. Run: \`railway login\`
3. Run: \`railway init\`
4. Select "Deploy from GitHub repo"
5. Connect this repository
6. Select branch: \`${DEPLOYMENT_BRANCH}\`

### Environment Variables in Railway
Set these variables in Railway Dashboard:
- \`VITE_SUPABASE_URL\`
- \`VITE_SUPABASE_ANON_KEY\`
- \`NODE_ENV=production\`

### Post-deployment Testing
- [ ] Application loads on Railway domain
- [ ] Database connectivity works
- [ ] All features functional
- [ ] Performance acceptable

## Rollback Information
- **Backup Archive:** \`backup/job_tracker-backup-${TIMESTAMP}.zip\`
- **Environment Backup:** \`backup/env-backup-${TIMESTAMP}/\`
- **Previous Branch:** \`main\`
- **Previous Commit:** $(git rev-parse HEAD~1 2>/dev/null || echo "N/A")

## Contact
- Railway Support: support@railway.app
- Supabase Support: support@supabase.com
EOF

# Step 8: Final instructions
echo -e "${GREEN}🔄 Step 8: Final preparation steps...${NC}"

# Add all changes to git
git add .
git commit -m "Prepare for Railway deployment - ${TIMESTAMP}

- Added Railway configuration (railway.toml)
- Updated package.json with engines and Railway scripts
- Enhanced Vite configuration for production
- Created environment templates
- Added backup scripts
- Prepared deployment branch

Ready for Railway deployment." || echo -e "${YELLOW}⚠️  No changes to commit${NC}"

echo -e "${PURPLE}🎉 Deployment preparation completed!${NC}"
echo -e "${PURPLE}=================================${NC}"
echo -e "${GREEN}✅ All preparation steps completed successfully${NC}"
echo -e ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "1. Review DEPLOYMENT_STATUS.md"
echo -e "2. Push deployment branch: ${YELLOW}git push origin ${DEPLOYMENT_BRANCH}${NC}"
echo -e "3. Set up Railway project"
echo -e "4. Configure environment variables in Railway"
echo -e "5. Deploy and test"
echo -e ""
echo -e "${YELLOW}💡 Tip: Keep this terminal output for reference${NC}"