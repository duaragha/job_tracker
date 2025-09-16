#!/bin/bash

# Create Railway Project Script
echo "🚀 Creating Railway Project..."

# Try to create a new project using Railway deploy command
# This should trigger project creation if none exists
echo "📝 Attempting to create Railway project via deployment..."

# First check if there are any existing projects we can link to
echo "Checking existing projects..."
railway list

# Create a minimal railway.json to help with project creation
cat > .railway.json << 'EOF'
{
  "deploy": {
    "startCommand": "npm run preview",
    "buildCommand": "npm run build"
  }
}
EOF

echo "✅ Railway configuration ready"

# Try to deploy which should trigger project creation
echo "🚀 Starting deployment (this will create the project)..."
railway up --detach || echo "Project creation pending..."

# Clean up
rm -f .railway.json

echo "📋 Project should now be visible in Railway dashboard"
echo "🌐 Check: https://railway.app/dashboard"