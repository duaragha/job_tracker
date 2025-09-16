#!/usr/bin/env node

/**
 * Rollback Strategy Script for Job Tracker Application
 * Provides automated rollback procedures for database and deployment issues
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Rollback scenarios and procedures
 */
const ROLLBACK_SCENARIOS = {
  CONNECTION_FAILURE: {
    name: 'Database Connection Failure',
    description: 'Application cannot connect to Supabase database',
    severity: 'HIGH',
    estimatedTime: '5-10 minutes'
  },
  PERFORMANCE_DEGRADATION: {
    name: 'Performance Degradation',
    description: 'Database queries are slow or timing out',
    severity: 'MEDIUM',
    estimatedTime: '15-30 minutes'
  },
  DATA_CORRUPTION: {
    name: 'Data Corruption',
    description: 'Data integrity issues or missing records',
    severity: 'CRITICAL',
    estimatedTime: '30-60 minutes'
  },
  DEPLOYMENT_FAILURE: {
    name: 'Deployment Failure',
    description: 'Railway deployment is not working correctly',
    severity: 'HIGH',
    estimatedTime: '10-20 minutes'
  }
};

/**
 * Display rollback menu
 */
function displayMenu() {
  console.log('🚨 EMERGENCY ROLLBACK SYSTEM');
  console.log('============================\n');

  console.log('Available rollback scenarios:\n');

  Object.entries(ROLLBACK_SCENARIOS).forEach(([key, scenario], index) => {
    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Severity: ${scenario.severity}`);
    console.log(`   Estimated Time: ${scenario.estimatedTime}\n`);
  });

  console.log('0. Exit\n');
}

/**
 * Test current database state
 */
async function testDatabaseState() {
  console.log('🔍 Testing current database state...\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zpobmujczdnbujkrabau.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwb2JtdWpjemRuYnVqa3JhYmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NTY3NzksImV4cCI6MjA2ODAzMjc3OX0.e5Ph2fbiM3J7NX1s4w93ipU70s5iElFDGlLiZHBdHkM';

  const supabase = createClient(supabaseUrl, supabaseKey);

  const tests = {
    connectivity: false,
    performance: false,
    dataIntegrity: false
  };

  try {
    // Test connectivity
    const startTime = performance.now();
    const { data, error } = await supabase.from('jobs').select('id').limit(1);
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    if (!error && data) {
      tests.connectivity = true;
      console.log(`✅ Connectivity: PASS (${responseTime.toFixed(2)}ms)`);

      if (responseTime < 1000) {
        tests.performance = true;
        console.log('✅ Performance: PASS');
      } else {
        console.log('⚠️  Performance: SLOW');
      }
    } else {
      console.log(`❌ Connectivity: FAIL (${error?.message || 'Unknown error'})`);
    }

    // Test data integrity
    if (tests.connectivity) {
      const { count } = await supabase.from('jobs').select('*', { count: 'exact', head: true });

      if (count && count > 700) { // Expect around 794 records
        tests.dataIntegrity = true;
        console.log(`✅ Data Integrity: PASS (${count} records)`);
      } else {
        console.log(`❌ Data Integrity: FAIL (${count || 0} records - expected ~794)`);
      }
    }

  } catch (err) {
    console.log(`❌ Database test failed: ${err.message}`);
  }

  console.log('');
  return tests;
}

/**
 * Rollback procedure for connection failures
 */
async function rollbackConnectionFailure() {
  console.log('🔧 EXECUTING: Connection Failure Rollback');
  console.log('=========================================\n');

  const steps = [
    {
      name: 'Verify Environment Variables',
      action: async () => {
        console.log('1. Checking environment variables...');

        const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
          console.log(`❌ Missing environment variables: ${missingVars.join(', ')}`);
          console.log('   → Check Railway dashboard environment variables');
          return false;
        }

        console.log('✅ Environment variables are set');
        return true;
      }
    },
    {
      name: 'Test Supabase Service Status',
      action: async () => {
        console.log('2. Testing Supabase service status...');

        try {
          const response = await fetch('https://status.supabase.com/api/v2/status.json');
          const status = await response.json();

          if (status.status.indicator === 'none') {
            console.log('✅ Supabase services are operational');
            return true;
          } else {
            console.log(`⚠️  Supabase status: ${status.status.description}`);
            console.log('   → Check https://status.supabase.com for updates');
            return false;
          }
        } catch (error) {
          console.log('⚠️  Could not check Supabase status');
          return true; // Continue anyway
        }
      }
    },
    {
      name: 'Verify CORS Settings',
      action: async () => {
        console.log('3. Checking CORS configuration...');
        console.log('   → Log into Supabase Dashboard');
        console.log('   → Go to Settings > API');
        console.log('   → Ensure Railway domain is in allowed origins');
        console.log('   → Update if necessary');

        return new Promise((resolve) => {
          console.log('\n   Have you verified CORS settings? (y/n):');
          process.stdin.once('data', (data) => {
            const answer = data.toString().trim().toLowerCase();
            if (answer === 'y' || answer === 'yes') {
              console.log('✅ CORS settings verified');
              resolve(true);
            } else {
              console.log('❌ CORS settings need attention');
              resolve(false);
            }
          });
        });
      }
    },
    {
      name: 'Test Direct Connection',
      action: async () => {
        console.log('4. Testing direct database connection...');

        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          console.log('❌ Cannot test - missing credentials');
          return false;
        }

        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data, error } = await supabase.from('jobs').select('id').limit(1);

          if (error) {
            console.log(`❌ Connection test failed: ${error.message}`);
            return false;
          }

          console.log('✅ Direct connection successful');
          return true;
        } catch (error) {
          console.log(`❌ Connection test failed: ${error.message}`);
          return false;
        }
      }
    }
  ];

  let allStepsPassed = true;

  for (const step of steps) {
    const result = await step.action();
    if (!result) {
      allStepsPassed = false;
    }
    console.log('');
  }

  if (allStepsPassed) {
    console.log('🎉 Connection failure rollback completed successfully!');
    console.log('   → Try redeploying the application');
  } else {
    console.log('⚠️  Some rollback steps failed.');
    console.log('   → Contact support or check Supabase documentation');
  }

  return allStepsPassed;
}

/**
 * Rollback procedure for performance issues
 */
async function rollbackPerformanceDegradation() {
  console.log('⚡ EXECUTING: Performance Degradation Rollback');
  console.log('==============================================\n');

  console.log('1. Analyzing current performance...');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Cannot analyze - missing credentials');
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test query performance
    const startTime = performance.now();
    const { data, error } = await supabase.from('jobs').select('*').limit(100);
    const endTime = performance.now();
    const queryTime = endTime - startTime;

    console.log(`   Query time: ${queryTime.toFixed(2)}ms`);

    if (queryTime > 2000) {
      console.log('❌ Performance is severely degraded');
      console.log('\n2. Recommended actions:');
      console.log('   → Check Supabase dashboard for resource usage');
      console.log('   → Consider upgrading Supabase plan');
      console.log('   → Implement query optimization');
      console.log('   → Add database indexes if missing');

      return false;
    } else if (queryTime > 1000) {
      console.log('⚠️  Performance is slow but acceptable');
      console.log('\n2. Optimization recommendations:');
      console.log('   → Monitor for continued degradation');
      console.log('   → Consider implementing pagination');
      console.log('   → Add client-side caching');

      return true;
    } else {
      console.log('✅ Performance is within acceptable range');
      return true;
    }

  } catch (error) {
    console.log(`❌ Performance test failed: ${error.message}`);
    return false;
  }
}

/**
 * Rollback procedure for data corruption
 */
async function rollbackDataCorruption() {
  console.log('💾 EXECUTING: Data Corruption Rollback');
  console.log('=====================================\n');

  console.log('🚨 WARNING: This is a critical procedure!');
  console.log('This will restore data from backup and may cause data loss.\n');

  // Find latest backup
  const backupDir = path.join(__dirname, '..', 'backup');

  if (!fs.existsSync(backupDir)) {
    console.log('❌ No backup directory found');
    console.log('   → Cannot proceed with data restoration');
    return false;
  }

  const backupFiles = fs.readdirSync(backupDir)
    .filter(file => file.startsWith('jobs-data-backup-') && file.endsWith('.json'))
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    console.log('❌ No backup files found');
    console.log('   → Cannot proceed with data restoration');
    return false;
  }

  const latestBackup = backupFiles[0];
  console.log(`📦 Latest backup found: ${latestBackup}`);

  return new Promise((resolve) => {
    console.log('\n⚠️  CRITICAL: Do you want to proceed with data restoration?');
    console.log('This will replace current data with backup data.');
    console.log('Type "RESTORE" to confirm, or anything else to cancel:');

    process.stdin.once('data', async (data) => {
      const answer = data.toString().trim();

      if (answer === 'RESTORE') {
        console.log('\n🔄 Starting data restoration...');

        try {
          const backupPath = path.join(backupDir, latestBackup);
          const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

          console.log(`   → Backup contains ${backupData.data.length} records`);
          console.log('   → This feature requires manual implementation');
          console.log('   → Contact database administrator for assistance');

          resolve(false); // Not implemented for safety

        } catch (error) {
          console.log(`❌ Restoration failed: ${error.message}`);
          resolve(false);
        }
      } else {
        console.log('❌ Data restoration cancelled');
        resolve(false);
      }
    });
  });
}

/**
 * Rollback procedure for deployment failures
 */
async function rollbackDeploymentFailure() {
  console.log('🚀 EXECUTING: Deployment Failure Rollback');
  console.log('=========================================\n');

  console.log('1. Deployment rollback options:\n');
  console.log('   A. Rollback to previous Railway deployment');
  console.log('   B. Redeploy current version');
  console.log('   C. Check deployment logs\n');

  return new Promise((resolve) => {
    console.log('Select option (A/B/C):');

    process.stdin.once('data', (data) => {
      const choice = data.toString().trim().toUpperCase();

      switch (choice) {
        case 'A':
          console.log('\n🔄 Railway Deployment Rollback:');
          console.log('   → Log into Railway dashboard');
          console.log('   → Go to your project deployments');
          console.log('   → Find the last working deployment');
          console.log('   → Click "Redeploy" on that version');
          console.log('   → Monitor deployment status');
          resolve(true);
          break;

        case 'B':
          console.log('\n🔄 Redeploy Current Version:');
          console.log('   → Log into Railway dashboard');
          console.log('   → Go to your project');
          console.log('   → Click "Deploy" to trigger new deployment');
          console.log('   → Monitor deployment logs for errors');
          resolve(true);
          break;

        case 'C':
          console.log('\n📋 Check Deployment Logs:');
          console.log('   → Log into Railway dashboard');
          console.log('   → Go to your project deployments');
          console.log('   → Click on the failed deployment');
          console.log('   → Review build and runtime logs');
          console.log('   → Look for specific error messages');
          resolve(true);
          break;

        default:
          console.log('❌ Invalid option selected');
          resolve(false);
      }
    });
  });
}

/**
 * Generate rollback report
 */
function generateRollbackReport(scenario, success, details = {}) {
  const timestamp = new Date().toISOString();

  const report = {
    timestamp,
    scenario: scenario.name,
    success,
    severity: scenario.severity,
    estimatedTime: scenario.estimatedTime,
    actualTime: details.actualTime || 'Not tracked',
    steps: details.steps || [],
    recommendations: details.recommendations || [],
    followUp: details.followUp || []
  };

  // Save report
  const reportDir = path.join(__dirname, '..', 'backup');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportFile = path.join(reportDir, `rollback-report-${timestamp.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`\n📄 Rollback report saved: ${path.basename(reportFile)}`);

  return report;
}

/**
 * Main interactive menu
 */
async function main() {
  // Test current state first
  const currentState = await testDatabaseState();

  displayMenu();

  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    console.log('Select a rollback scenario (1-4) or 0 to exit:');

    process.stdin.once('data', async (data) => {
      const choice = parseInt(data.toString().trim());

      if (choice === 0) {
        console.log('Exiting rollback system.');
        process.stdin.pause();
        resolve(true);
        return;
      }

      const scenarios = Object.values(ROLLBACK_SCENARIOS);
      const scenario = scenarios[choice - 1];

      if (!scenario) {
        console.log('❌ Invalid choice. Please select 1-4 or 0 to exit.');
        process.stdin.pause();
        resolve(false);
        return;
      }

      console.log(`\n🚀 Starting rollback for: ${scenario.name}`);
      console.log(`Estimated time: ${scenario.estimatedTime}\n`);

      const startTime = performance.now();
      let success = false;

      try {
        switch (choice) {
          case 1:
            success = await rollbackConnectionFailure();
            break;
          case 2:
            success = await rollbackPerformanceDegradation();
            break;
          case 3:
            success = await rollbackDataCorruption();
            break;
          case 4:
            success = await rollbackDeploymentFailure();
            break;
        }
      } catch (error) {
        console.log(`❌ Rollback failed: ${error.message}`);
        success = false;
      }

      const endTime = performance.now();
      const actualTime = `${((endTime - startTime) / 1000).toFixed(2)} seconds`;

      generateRollbackReport(scenario, success, { actualTime });

      if (success) {
        console.log('\n🎉 Rollback procedure completed successfully!');
      } else {
        console.log('\n⚠️  Rollback procedure completed with issues.');
        console.log('Please review the steps and contact support if needed.');
      }

      process.stdin.pause();
      resolve(success);
    });
  });
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Rollback script crashed:', error);
      process.exit(1);
    });
}

export { main as executeRollback };