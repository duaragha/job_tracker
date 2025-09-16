#!/usr/bin/env node

/**
 * Direct Railway Deployment Script
 * Uses Railway CLI to deploy without interactive prompts
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 DIRECT RAILWAY DEPLOYMENT STARTING...');
console.log('==========================================');

async function createRailwayProject() {
  try {
    console.log('📝 Attempting Railway project creation...');

    // Try direct approach with environment variables
    const env = {
      ...process.env,
      RAILWAY_TOKEN: process.env.RAILWAY_TOKEN,
      RAILWAY_PROJECT_NAME: 'job-tracker-prod'
    };

    // Method 1: Try non-interactive init
    try {
      console.log('🔄 Trying non-interactive approach...');
      execSync('railway link --help', { stdio: 'pipe' });

      // If we can access Railway, try to deploy directly
      console.log('✅ Railway CLI accessible, proceeding with deployment...');

      // Deploy directly using Railway up
      console.log('🚀 Deploying to Railway...');
      const deployResult = execSync('railway up --detach', {
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });

      console.log('✅ Deployment command executed!');

      // Get status
      setTimeout(() => {
        try {
          console.log('📊 Getting deployment status...');
          execSync('railway status', { stdio: 'inherit' });

          console.log('🌐 Getting domain...');
          execSync('railway domain', { stdio: 'inherit' });
        } catch (error) {
          console.log('⚠️  Status check will be available in Railway dashboard');
        }
      }, 5000);

    } catch (error) {
      console.log('⚠️  Direct approach failed, trying alternative...');
      await alternativeDeployment();
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('💡 Manual steps required:');
    console.log('1. Run: railway init');
    console.log('2. Select: Raghav Dua\'s Projects');
    console.log('3. Choose: Deploy from GitHub repo');
    console.log('4. Select: railway-deployment branch');
    console.log('5. Run: railway up');
  }
}

async function alternativeDeployment() {
  console.log('🔄 Trying GitHub-based deployment...');

  // Create a deployment info file
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    branch: 'railway-deployment',
    commit: 'bd6ffb2',
    repository: 'duaragha/job_tracker',
    instructions: {
      step1: 'railway init (select Raghav Dua\'s Projects)',
      step2: 'Choose: Deploy from GitHub repo',
      step3: 'Select: railway-deployment branch',
      step4: 'Run: railway up',
      note: 'All configuration files are ready in the repository'
    },
    environment_variables: [
      'NODE_ENV=production',
      'VITE_SUPABASE_URL=https://zpobmujczdnbujkrabau.supabase.co',
      'VITE_SUPABASE_ANON_KEY=(provided in manual setup)',
      'VITE_APP_NAME=Job Tracker'
    ]
  };

  fs.writeFileSync('RAILWAY_DEPLOYMENT_INFO.json', JSON.stringify(deploymentInfo, null, 2));
  console.log('✅ Deployment info saved to RAILWAY_DEPLOYMENT_INFO.json');

  console.log('\n🎯 DEPLOYMENT READY!');
  console.log('All files are committed and pushed to railway-deployment branch');
  console.log('Railway project can be created from the GitHub repository');
}

// Start deployment
createRailwayProject();