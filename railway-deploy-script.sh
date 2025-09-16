#!/bin/bash

# Railway Deployment Script
# Deploys the Job Tracker app to Railway

echo "🚀 Starting Railway Deployment Process..."
echo "========================================"

# Step 1: Check if already connected to Railway
if [ ! -f ".railway/config.json" ]; then
    echo "📝 No Railway project found. Creating new project..."
    echo "Please manually run: railway init"
    echo "Select: Raghav Dua's Projects workspace"
    echo "Then run this script again."
    exit 1
fi

echo "✅ Railway project found"

# Step 2: Deploy the application
echo "🚀 Deploying to Railway..."
railway up --detach

# Step 3: Check deployment status
echo "📊 Checking deployment status..."
sleep 10
railway status

# Step 4: Get the URL
echo "🌐 Getting deployment URL..."
railway domain

echo ""
echo "✅ Deployment process completed!"
echo "Check Railway dashboard for full details"
echo "Remember to update Supabase CORS settings with the new domain"