#!/usr/bin/env node

/**
 * Database Validation Script for Job Tracker Application
 * Validates database integrity after migration/deployment
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zpobmujczdnbujkrabau.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwb2JtdWpjemRuYnVqa3JhYmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NTY3NzksImV4cCI6MjA2ODAzMjc3OX0.e5Ph2fbiM3J7NX1s4w93ipU70s5iElFDGlLiZHBdHkM';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Expected database state (based on current analysis)
 */
const EXPECTED_STATE = {
  minRecords: 790, // Allow for some variance
  maxRecords: 800,
  requiredColumns: ['id', 'company', 'position', 'location', 'status', 'appliedDate', 'rejectionDate', 'jobSite', 'url', 'created_at'],
  statusValues: ['Applied', 'Rejected', 'Assessment', 'Interviewing', 'Screening'],
  dataCompletenessThreshold: 85 // Minimum 85% data completeness
};

/**
 * Test database connectivity
 */
async function testConnectivity() {
  console.log('🔍 Testing database connectivity...');

  try {
    const startTime = performance.now();

    const { data, error } = await supabase
      .from('jobs')
      .select('id')
      .limit(1);

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    if (error) {
      return {
        success: false,
        error: `Connection failed: ${error.message}`,
        responseTime: null
      };
    }

    const isHealthy = responseTime < 1000; // Under 1 second is healthy

    return {
      success: true,
      responseTime: responseTime.toFixed(2),
      healthy: isHealthy,
      message: isHealthy ? 'Connection is healthy' : 'Connection is slow but working'
    };

  } catch (error) {
    return {
      success: false,
      error: `Connection test failed: ${error.message}`,
      responseTime: null
    };
  }
}

/**
 * Validate schema structure
 */
async function validateSchema() {
  console.log('📋 Validating schema structure...');

  try {
    const { data: sample, error } = await supabase
      .from('jobs')
      .select('*')
      .limit(1);

    if (error) {
      return {
        success: false,
        error: `Schema validation failed: ${error.message}`
      };
    }

    if (!sample || sample.length === 0) {
      return {
        success: false,
        error: 'No data found to validate schema'
      };
    }

    const record = sample[0];
    const actualColumns = Object.keys(record);
    const missingColumns = EXPECTED_STATE.requiredColumns.filter(col => !actualColumns.includes(col));
    const extraColumns = actualColumns.filter(col => !EXPECTED_STATE.requiredColumns.includes(col));

    const schemaValid = missingColumns.length === 0;

    return {
      success: schemaValid,
      actualColumns,
      expectedColumns: EXPECTED_STATE.requiredColumns,
      missingColumns,
      extraColumns,
      error: missingColumns.length > 0 ? `Missing required columns: ${missingColumns.join(', ')}` : null
    };

  } catch (error) {
    return {
      success: false,
      error: `Schema validation failed: ${error.message}`
    };
  }
}

/**
 * Validate data integrity
 */
async function validateDataIntegrity() {
  console.log('🔍 Validating data integrity...');

  try {
    // Get all data for comprehensive validation
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*');

    if (error) {
      return {
        success: false,
        error: `Data validation failed: ${error.message}`
      };
    }

    const recordCount = jobs.length;
    const recordCountValid = recordCount >= EXPECTED_STATE.minRecords && recordCount <= EXPECTED_STATE.maxRecords;

    // Validate status values
    const statusValues = [...new Set(jobs.map(job => job.status))];
    const invalidStatuses = statusValues.filter(status => !EXPECTED_STATE.statusValues.includes(status));

    // Calculate data completeness
    let totalFields = 0;
    let filledFields = 0;

    jobs.forEach(job => {
      Object.keys(job).forEach(key => {
        totalFields++;
        if (job[key] !== null && job[key] !== '' && job[key] !== undefined) {
          filledFields++;
        }
      });
    });

    const dataCompleteness = (filledFields / totalFields) * 100;
    const completenessValid = dataCompleteness >= EXPECTED_STATE.dataCompletenessThreshold;

    // Validate required field presence
    let requiredFieldIssues = [];
    jobs.forEach((job, index) => {
      if (!job.id) requiredFieldIssues.push(`Record ${index}: Missing ID`);
      if (!job.company) requiredFieldIssues.push(`Record ${index}: Missing company`);
      if (!job.position) requiredFieldIssues.push(`Record ${index}: Missing position`);
      if (!job.status) requiredFieldIssues.push(`Record ${index}: Missing status`);
    });

    const dataIntegrityValid = recordCountValid && invalidStatuses.length === 0 &&
                              completenessValid && requiredFieldIssues.length === 0;

    return {
      success: dataIntegrityValid,
      recordCount,
      recordCountValid,
      expectedRange: `${EXPECTED_STATE.minRecords}-${EXPECTED_STATE.maxRecords}`,
      statusValues,
      invalidStatuses,
      dataCompleteness: dataCompleteness.toFixed(1),
      completenessValid,
      requiredFieldIssues: requiredFieldIssues.slice(0, 10), // First 10 issues
      totalRequiredFieldIssues: requiredFieldIssues.length
    };

  } catch (error) {
    return {
      success: false,
      error: `Data integrity validation failed: ${error.message}`
    };
  }
}

/**
 * Test CRUD operations
 */
async function testCRUDOperations() {
  console.log('⚙️ Testing CRUD operations...');

  const testJobId = `test-${Date.now()}`;
  const testJob = {
    company: 'Test Company (Validation)',
    position: 'Test Position',
    location: 'Test Location',
    status: 'Applied',
    appliedDate: new Date().toISOString().split('T')[0],
    jobSite: 'Test',
    url: 'https://test.com',
    created_at: new Date().toISOString()
  };

  try {
    // Test CREATE
    const { data: createdJob, error: createError } = await supabase
      .from('jobs')
      .insert([testJob])
      .select();

    if (createError) {
      return {
        success: false,
        operation: 'CREATE',
        error: createError.message
      };
    }

    const insertedId = createdJob[0].id;

    // Test READ
    const { data: readJob, error: readError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', insertedId)
      .single();

    if (readError) {
      // Cleanup
      await supabase.from('jobs').delete().eq('id', insertedId);
      return {
        success: false,
        operation: 'READ',
        error: readError.message
      };
    }

    // Test UPDATE
    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({ status: 'Testing' })
      .eq('id', insertedId)
      .select();

    if (updateError) {
      // Cleanup
      await supabase.from('jobs').delete().eq('id', insertedId);
      return {
        success: false,
        operation: 'UPDATE',
        error: updateError.message
      };
    }

    // Test DELETE
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .eq('id', insertedId);

    if (deleteError) {
      return {
        success: false,
        operation: 'DELETE',
        error: deleteError.message
      };
    }

    // Verify deletion
    const { data: verifyDeleted } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', insertedId);

    if (verifyDeleted && verifyDeleted.length > 0) {
      return {
        success: false,
        operation: 'DELETE_VERIFY',
        error: 'Record was not properly deleted'
      };
    }

    return {
      success: true,
      operations: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
      testId: insertedId
    };

  } catch (error) {
    return {
      success: false,
      operation: 'CRUD_TEST',
      error: `CRUD test failed: ${error.message}`
    };
  }
}

/**
 * Performance validation
 */
async function validatePerformance() {
  console.log('⚡ Validating performance...');

  try {
    // Test full table query performance
    const fullQueryStart = performance.now();
    const { data: allJobs, error: allError } = await supabase
      .from('jobs')
      .select('*')
      .order('appliedDate', { ascending: false });

    const fullQueryEnd = performance.now();
    const fullQueryTime = fullQueryEnd - fullQueryStart;

    if (allError) {
      return {
        success: false,
        error: `Performance test failed: ${allError.message}`
      };
    }

    // Test filtered query performance
    const filteredQueryStart = performance.now();
    const { data: filteredJobs, error: filteredError } = await supabase
      .from('jobs')
      .select('*')
      .in('status', ['Applied', 'Interviewing'])
      .order('appliedDate', { ascending: false })
      .limit(100);

    const filteredQueryEnd = performance.now();
    const filteredQueryTime = filteredQueryEnd - filteredQueryStart;

    if (filteredError) {
      return {
        success: false,
        error: `Filtered query test failed: ${filteredError.message}`
      };
    }

    // Performance thresholds
    const fullQueryAcceptable = fullQueryTime < 2000; // 2 seconds for full table
    const filteredQueryAcceptable = filteredQueryTime < 500; // 500ms for filtered

    return {
      success: fullQueryAcceptable && filteredQueryAcceptable,
      fullQueryTime: fullQueryTime.toFixed(2),
      filteredQueryTime: filteredQueryTime.toFixed(2),
      fullQueryAcceptable,
      filteredQueryAcceptable,
      totalRecords: allJobs.length,
      filteredRecords: filteredJobs.length
    };

  } catch (error) {
    return {
      success: false,
      error: `Performance validation failed: ${error.message}`
    };
  }
}

/**
 * Compare with backup checksums
 */
async function compareWithBackup() {
  console.log('🔍 Comparing with backup checksums...');

  try {
    // Look for the most recent backup file
    const backupDir = path.join(__dirname, '..', 'backup');

    if (!fs.existsSync(backupDir)) {
      return {
        success: false,
        error: 'No backup directory found - cannot compare checksums'
      };
    }

    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('jobs-data-backup-') && file.endsWith('.json'))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      return {
        success: false,
        error: 'No backup files found - cannot compare checksums'
      };
    }

    const latestBackup = backupFiles[0];
    const backupPath = path.join(backupDir, latestBackup);
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    // Get current data checksums
    const { data: currentJobs } = await supabase.from('jobs').select('*');

    const currentChecksums = generateChecksums(currentJobs);
    const backupChecksums = backupData.checksums;

    // Compare checksums
    const recordCountMatch = currentChecksums.totalRecords === backupChecksums.totalRecords;
    const statusDistributionMatch = JSON.stringify(currentChecksums.statusDistribution) ===
                                   JSON.stringify(backupChecksums.statusDistribution);

    return {
      success: recordCountMatch && statusDistributionMatch,
      backupFile: latestBackup,
      current: currentChecksums,
      backup: backupChecksums,
      recordCountMatch,
      statusDistributionMatch
    };

  } catch (error) {
    return {
      success: false,
      error: `Backup comparison failed: ${error.message}`
    };
  }
}

/**
 * Generate checksums for comparison
 */
function generateChecksums(jobs) {
  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRecords: jobs.length,
    statusDistribution: statusCounts,
    uniqueCompanies: [...new Set(jobs.map(j => j.company))].length,
    uniquePositions: [...new Set(jobs.map(j => j.position))].length
  };
}

/**
 * Generate validation report
 */
function generateReport(results) {
  const timestamp = new Date().toISOString();

  let report = `# Database Validation Report
**Generated:** ${timestamp}
**Database:** ${supabaseUrl}

## Summary

`;

  const allTests = Object.keys(results);
  const passedTests = allTests.filter(test => results[test].success);
  const failedTests = allTests.filter(test => !results[test].success);

  report += `**Overall Status:** ${failedTests.length === 0 ? '✅ PASSED' : '❌ FAILED'}\n`;
  report += `**Tests Passed:** ${passedTests.length}/${allTests.length}\n\n`;

  // Detailed results
  report += `## Detailed Results\n\n`;

  Object.entries(results).forEach(([testName, result]) => {
    report += `### ${testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}\n`;
    report += `**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`;

    if (result.error) {
      report += `**Error:** ${result.error}\n`;
    }

    // Add specific details based on test type
    if (testName === 'connectivity' && result.success) {
      report += `**Response Time:** ${result.responseTime}ms\n`;
    }

    if (testName === 'performance' && result.success) {
      report += `**Full Query Time:** ${result.fullQueryTime}ms\n`;
      report += `**Filtered Query Time:** ${result.filteredQueryTime}ms\n`;
    }

    if (testName === 'dataIntegrity') {
      report += `**Record Count:** ${result.recordCount}\n`;
      report += `**Data Completeness:** ${result.dataCompleteness}%\n`;
    }

    report += `\n`;
  });

  return report;
}

/**
 * Main validation function
 */
async function main() {
  console.log('🚀 Starting comprehensive database validation...');
  console.log('============================================\n');

  const results = {
    connectivity: await testConnectivity(),
    schema: await validateSchema(),
    dataIntegrity: await validateDataIntegrity(),
    crudOperations: await testCRUDOperations(),
    performance: await validatePerformance(),
    backupComparison: await compareWithBackup()
  };

  console.log('\n📊 Validation Summary:');
  console.log('======================');

  Object.entries(results).forEach(([test, result]) => {
    const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`${testName}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);

    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });

  // Generate detailed report
  const report = generateReport(results);
  const reportPath = path.join(__dirname, '..', 'backup', `validation-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);

  // Ensure backup directory exists
  const backupDir = path.join(__dirname, '..', 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, report);

  const allPassed = Object.values(results).every(r => r.success);

  if (allPassed) {
    console.log('\n🎉 All validation tests passed!');
    console.log('Database is ready for production use.');
  } else {
    console.log('\n⚠️ Some validation tests failed.');
    console.log('Please review the issues before proceeding.');
  }

  console.log(`\n📄 Detailed report saved to: ${path.basename(reportPath)}`);

  return allPassed;
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Validation script crashed:', error);
      process.exit(1);
    });
}

export { main as validateDatabase };