#!/usr/bin/env node

/**
 * Database Backup Script for Job Tracker Application
 * Creates comprehensive backup of Supabase database before migration
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
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create backup directory
const backupDir = path.join(__dirname, '..', 'backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Generate timestamp for backup files
 */
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
         new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
}

/**
 * Create data backup
 */
async function backupData() {
  console.log('📦 Creating data backup...');

  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const timestamp = getTimestamp();
    const filename = `jobs-data-backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    // Create comprehensive backup object
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        source: 'job-tracker-backup-script',
        supabaseUrl: supabaseUrl,
        totalRecords: jobs.length,
        backupType: 'full-data-export'
      },
      schema: {
        tableName: 'jobs',
        columns: jobs.length > 0 ? Object.keys(jobs[0]) : [],
        primaryKey: 'id',
        dataTypes: jobs.length > 0 ? getDataTypes(jobs[0]) : {}
      },
      data: jobs,
      checksums: generateChecksums(jobs)
    };

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`✅ Data backup created: ${filename}`);
    console.log(`📊 Records backed up: ${jobs.length}`);
    console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

    return { success: true, filename, recordCount: jobs.length };

  } catch (error) {
    console.error('❌ Data backup failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get data types of fields
 */
function getDataTypes(record) {
  const types = {};
  Object.keys(record).forEach(key => {
    const value = record[key];
    if (value === null) {
      types[key] = 'nullable';
    } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      types[key] = 'date';
    } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      types[key] = 'timestamp';
    } else if (typeof value === 'string' && value.length === 36 && value.includes('-')) {
      types[key] = 'uuid';
    } else {
      types[key] = typeof value;
    }
  });
  return types;
}

/**
 * Generate data checksums for validation
 */
function generateChecksums(jobs) {
  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  const companyCounts = jobs.reduce((acc, job) => {
    acc[job.company] = (acc[job.company] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRecords: jobs.length,
    statusDistribution: statusCounts,
    uniqueCompanies: Object.keys(companyCounts).length,
    uniquePositions: [...new Set(jobs.map(j => j.position))].length,
    dateRange: {
      earliest: Math.min(...jobs.map(j => new Date(j.appliedDate || '9999-12-31').getTime())),
      latest: Math.max(...jobs.map(j => new Date(j.appliedDate || '1900-01-01').getTime()))
    },
    sampleIds: jobs.slice(0, 5).map(j => j.id),
    lastCreated: jobs.map(j => j.created_at).sort().pop()
  };
}

/**
 * Create CSV backup for easy data recovery
 */
async function backupCSV() {
  console.log('📄 Creating CSV backup...');

  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (jobs.length === 0) {
      console.log('⚠️ No data to backup');
      return { success: true, filename: null, recordCount: 0 };
    }

    const timestamp = getTimestamp();
    const filename = `jobs-data-backup-${timestamp}.csv`;
    const filepath = path.join(backupDir, filename);

    // Create CSV content
    const headers = Object.keys(jobs[0]);
    const csvContent = [
      headers.join(','),
      ...jobs.map(job =>
        headers.map(header => {
          const value = job[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    fs.writeFileSync(filepath, csvContent);

    console.log(`✅ CSV backup created: ${filename}`);
    console.log(`📊 Records exported: ${jobs.length}`);

    return { success: true, filename, recordCount: jobs.length };

  } catch (error) {
    console.error('❌ CSV backup failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create schema documentation
 */
async function documentSchema() {
  console.log('📋 Creating schema documentation...');

  try {
    const { data: sample, error } = await supabase
      .from('jobs')
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`Schema query failed: ${error.message}`);
    }

    const timestamp = getTimestamp();
    const filename = `schema-documentation-${timestamp}.md`;
    const filepath = path.join(backupDir, filename);

    const schemaDoc = generateSchemaDocumentation(sample[0] || {});
    fs.writeFileSync(filepath, schemaDoc);

    console.log(`✅ Schema documentation created: ${filename}`);

    return { success: true, filename };

  } catch (error) {
    console.error('❌ Schema documentation failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate schema documentation
 */
function generateSchemaDocumentation(record) {
  const timestamp = new Date().toISOString();

  let doc = `# Database Schema Documentation
**Generated:** ${timestamp}
**Source:** ${supabaseUrl}

## Table: jobs

### Column Definitions

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
`;

  if (Object.keys(record).length > 0) {
    Object.keys(record).forEach(key => {
      const value = record[key];
      const type = getColumnType(value);
      const nullable = value === null ? 'YES' : 'NO';
      const description = getColumnDescription(key);

      doc += `| ${key} | ${type} | ${nullable} | ${description} |\n`;
    });
  }

  doc += `\n### Sample Record\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`;

  return doc;
}

/**
 * Get column type for documentation
 */
function getColumnType(value) {
  if (value === null) return 'Unknown (NULL)';
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) return 'DATE';
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return 'TIMESTAMPTZ';
  if (typeof value === 'string' && value.length === 36 && value.includes('-')) return 'UUID';
  if (typeof value === 'string') return 'TEXT';
  if (typeof value === 'number') return 'INTEGER';
  if (typeof value === 'boolean') return 'BOOLEAN';
  return 'UNKNOWN';
}

/**
 * Get column description
 */
function getColumnDescription(columnName) {
  const descriptions = {
    id: 'Primary key (UUID)',
    company: 'Company name',
    position: 'Job position title',
    location: 'Job location',
    status: 'Application status',
    appliedDate: 'Date application was submitted',
    rejectionDate: 'Date application was rejected (if applicable)',
    jobSite: 'Platform where job was found',
    url: 'Job posting URL',
    created_at: 'Record creation timestamp'
  };

  return descriptions[columnName] || 'No description available';
}

/**
 * Test database connectivity
 */
async function testConnection() {
  console.log('🔍 Testing database connection...');

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('count')
      .single();

    if (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }

    console.log('✅ Database connection verified');
    return { success: true };

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main backup function
 */
async function main() {
  console.log('🚀 Starting comprehensive database backup...');
  console.log('==========================================\n');

  const results = {
    connection: await testConnection(),
    dataBackup: await backupData(),
    csvBackup: await backupCSV(),
    schemaDoc: await documentSchema()
  };

  console.log('\n📊 Backup Summary:');
  console.log('==================');
  console.log(`Connection Test: ${results.connection.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Data Backup: ${results.dataBackup.success ? '✅ CREATED' : '❌ FAILED'}`);
  console.log(`CSV Backup: ${results.csvBackup.success ? '✅ CREATED' : '❌ FAILED'}`);
  console.log(`Schema Documentation: ${results.schemaDoc.success ? '✅ CREATED' : '❌ FAILED'}`);

  if (results.dataBackup.success) {
    console.log(`\n📦 Backup Details:`);
    console.log(`Records: ${results.dataBackup.recordCount}`);
    console.log(`Location: ./backup/`);
  }

  const allSuccess = Object.values(results).every(r => r.success);

  if (allSuccess) {
    console.log('\n🎉 Backup completed successfully!');
    console.log('Your database is ready for migration.');
  } else {
    console.log('\n⚠️ Backup completed with some failures.');
    console.log('Please review the errors above before proceeding.');
  }

  return allSuccess;
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Backup script crashed:', error);
      process.exit(1);
    });
}

export { main as backupDatabase };