#!/bin/bash

# Automated Railway Deployment Script
# This script will handle the entire deployment process automatically

echo "🚀 AUTOMATED RAILWAY DEPLOYMENT STARTING..."
echo "=========================================="

# Step 1: Create Railway project automatically
echo "📝 Creating Railway project..."

# Use expect to handle interactive prompts automatically
expect << 'EOF'
spawn railway init
expect "Select a workspace"
send "1\r"
expect "Select source"
send "1\r"
expect "Select repo"
send "1\r"
expect "Select branch"
send "1\r"
expect eof
EOF

if [ $? -eq 0 ]; then
    echo "✅ Railway project created successfully!"
else
    echo "⚠️  Trying alternative approach..."
    # Alternative: Use pre-configured responses
    echo -e "1\n1\n1\n1\n" | railway init
fi

# Step 2: Set environment variables
echo "🔧 Configuring environment variables..."

railway variables --set "NODE_ENV=production"
railway variables --set "VITE_SUPABASE_URL=https://zpobmujczdnbujkrabau.supabase.co"
railway variables --set "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwb2JtdWpjemRuYnVqa3JhYmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NTY3NzksImV4cCI6MjA2ODAzMjc3OX0.e5Ph2fbiM3J7NX1s4w93ipU70s5iElFDGlLiZHBdHkM"
railway variables --set "VITE_APP_NAME=Job Tracker"
railway variables --set "VITE_APP_VERSION=1.0.0"
railway variables --set "VITE_ENVIRONMENT=production"

echo "✅ Environment variables configured!"

# Step 3: Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up --detach

# Step 4: Get deployment info
echo "📊 Getting deployment information..."
sleep 15
railway status
railway domain

echo ""
echo "🎉 DEPLOYMENT COMPLETED!"
echo "Check your Railway dashboard for the new project"
echo "Remember to update Supabase CORS with the new domain"