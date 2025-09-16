#!/usr/bin/env node

/**
 * Railway Project Initialization Script
 * Creates a new Railway project and configures deployment
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Railway Project Creation...');
console.log('===========================================');

async function initializeRailwayProject() {
  try {
    // Step 1: Initialize Railway project
    console.log('📝 Creating Railway project...');

    // Use spawn for interactive commands
    const railwayInit = spawn('railway', ['init'], {
      stdio: 'inherit',
      shell: true
    });

    railwayInit.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Railway project created successfully!');
        configureEnvironmentVariables();
      } else {
        console.error('❌ Railway project creation failed');
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Error during Railway initialization:', error.message);
    process.exit(1);
  }
}

function configureEnvironmentVariables() {
  console.log('\n🔧 Configuring environment variables...');

  try {
    // Set environment variables one by one
    const envVars = [
      'NODE_ENV=production',
      'VITE_SUPABASE_URL=https://zpobmujczdnbujkrabau.supabase.co',
      'VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwb2JtdWpjemRuYnVqa3JhYmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NTY3NzksImV4cCI6MjA2ODAzMjc3OX0.e5Ph2fbiM3J7NX1s4w93ipU70s5iElFDGlLiZHBdHkM',
      'VITE_APP_NAME=Job Tracker',
      'VITE_APP_VERSION=1.0.0',
      'VITE_ENVIRONMENT=production'
    ];

    envVars.forEach(envVar => {
      try {
        execSync(`railway variables set ${envVar}`, { stdio: 'inherit' });
        console.log(`✅ Set: ${envVar.split('=')[0]}`);
      } catch (error) {
        console.log(`⚠️  Manual setup required for: ${envVar.split('=')[0]}`);
      }
    });

    deployToRailway();
  } catch (error) {
    console.error('⚠️  Environment variable setup needs manual configuration');
    deployToRailway();
  }
}

function deployToRailway() {
  console.log('\n🚀 Deploying to Railway...');

  try {
    // Deploy the application
    execSync('railway up', { stdio: 'inherit' });
    console.log('✅ Deployment initiated successfully!');

    // Get deployment URL
    setTimeout(() => {
      try {
        const output = execSync('railway status', { encoding: 'utf8' });
        console.log('\n📊 Railway Status:');
        console.log(output);
      } catch (error) {
        console.log('⚠️  Check Railway dashboard for deployment status');
      }
    }, 2000);

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('💡 Try manually: railway up');
  }
}

// Start the process
initializeRailwayProject();