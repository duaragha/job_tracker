#!/usr/bin/env node

/**
 * Railway Test Suite Orchestrator
 * Master test runner that coordinates all Railway deployment testing
 * Runs validation, performance, rollback, monitoring, and UAT tests in sequence
 * Usage: node scripts/railway-test-suite-orchestrator.js [options]
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test orchestration configuration
const ORCHESTRATOR_CONFIG = {
  suites: [
    {
      name: 'Railway Deployment Validation',
      script: 'railway-deployment-validator.js',
      description: 'Validates Railway environment setup and configuration',
      critical: true,
      timeout: 300000, // 5 minutes
      retryOnFailure: true,
      maxRetries: 2
    },
    {
      name: 'Railway Performance Benchmark',
      script: 'railway-performance-benchmark.js',
      description: 'Benchmarks performance on Railway vs local environment',
      critical: true,
      timeout: 600000, // 10 minutes
      retryOnFailure: false,
      maxRetries: 1
    },
    {
      name: 'Rollback Testing',
      script: 'rollback-testing-suite.js',
      description: 'Tests rollback procedures and failure recovery',
      critical: true,
      timeout: 300000, // 5 minutes
      retryOnFailure: true,
      maxRetries: 1
    },
    {
      name: 'User Acceptance Testing',
      script: 'user-acceptance-testing.js',
      description: 'Validates user scenarios and business requirements',
      critical: true,
      timeout: 600000, // 10 minutes
      retryOnFailure: false,
      maxRetries: 1
    }
  ],
  monitoring: {
    script: 'monitoring-health-checks.js',
    description: 'Continuous monitoring and health checks',
    background: true,
    timeout: 0 // No timeout for monitoring
  },
  reporting: {
    generateMasterReport: true,
    includeScreenshots: true,
    sendNotifications: false,
    saveToRepository: true
  },
  deployment: {
    autoApprove: false,
    requireManualReview: true,
    approvalThreshold: 0.9 // 90% pass rate required
  }
};

class RailwayTestOrchestrator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      orchestrationId: this.generateId(),
      environment: {
        railway: process.env.RAILWAY_STATIC_URL || 'https://your-app.railway.app',
        local: 'http://localhost:5173',
        nodeVersion: process.version,
        platform: process.platform
      },
      suiteResults: {},
      monitoring: {
        started: false,
        pid: null,
        status: 'not-started'
      },
      summary: {
        totalSuites: ORCHESTRATOR_CONFIG.suites.length,
        completedSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        overallPassRate: 0,
        deploymentRecommendation: 'pending',
        executionTime: 0,
        criticalIssues: [],
        warnings: []
      }
    };
  }

  generateId() {
    return `railway-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async setup() {
    console.log('🎭 Railway Test Suite Orchestrator');
    console.log('==================================');
    console.log(`🆔 Orchestration ID: ${this.results.orchestrationId}`);
    console.log(`🎯 Railway URL: ${this.results.environment.railway}`);
    console.log(`🖥️  Local URL: ${this.results.environment.local}`);
    console.log(`📅 Started: ${this.results.timestamp}`);
    console.log('');

    // Ensure test results directory exists
    this.ensureDirectories();

    // Validate environment
    await this.validateEnvironment();

    console.log('✅ Orchestrator setup complete');
    console.log('');
  }

  ensureDirectories() {
    const dirs = [
      'test-results',
      'test-results/screenshots',
      'test-results/reports',
      'test-results/monitoring'
    ];

    dirs.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  async validateEnvironment() {
    console.log('🔧 Validating environment...');

    const validations = [];

    // Check Railway URL
    if (!process.env.RAILWAY_STATIC_URL) {
      validations.push('⚠️  RAILWAY_STATIC_URL not set - using default');
    } else {
      validations.push('✅ RAILWAY_STATIC_URL configured');
    }

    // Check Supabase configuration
    if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
      validations.push('⚠️  Supabase environment variables not fully configured');
    } else {
      validations.push('✅ Supabase configuration found');
    }

    // Check test scripts exist
    const scriptDir = path.dirname(__filename);
    for (const suite of ORCHESTRATOR_CONFIG.suites) {
      const scriptPath = path.join(scriptDir, suite.script);
      if (fs.existsSync(scriptPath)) {
        validations.push(`✅ ${suite.script} found`);
      } else {
        validations.push(`❌ ${suite.script} missing`);
        throw new Error(`Required test script not found: ${suite.script}`);
      }
    }

    validations.forEach(validation => console.log(`  ${validation}`));
    console.log('');
  }

  async startMonitoring() {
    if (!ORCHESTRATOR_CONFIG.monitoring.script) return;

    console.log('🔍 Starting background monitoring...');

    const scriptPath = path.join(path.dirname(__filename), ORCHESTRATOR_CONFIG.monitoring.script);

    if (!fs.existsSync(scriptPath)) {
      console.log('⚠️  Monitoring script not found, skipping...');
      return;
    }

    try {
      const monitoringProcess = spawn('node', [scriptPath], {
        detached: true,
        stdio: 'pipe',
        env: process.env
      });

      this.results.monitoring = {
        started: true,
        pid: monitoringProcess.pid,
        status: 'running',
        startTime: new Date().toISOString()
      };

      // Don't wait for monitoring to finish
      monitoringProcess.unref();

      console.log(`✅ Monitoring started (PID: ${monitoringProcess.pid})`);
      console.log('');

    } catch (error) {
      console.log(`⚠️  Could not start monitoring: ${error.message}`);
      this.results.monitoring.status = 'failed-to-start';
    }
  }

  async runTestSuite(suite) {
    console.log(`\n🧪 RUNNING: ${suite.name}`);
    console.log('='.repeat(50));
    console.log(`📄 Script: ${suite.script}`);
    console.log(`📝 Description: ${suite.description}`);
    console.log(`⚠️  Critical: ${suite.critical ? 'Yes' : 'No'}`);
    console.log('');

    const startTime = performance.now();
    let attempts = 0;
    let lastError = null;

    while (attempts <= suite.maxRetries) {
      attempts++;

      if (attempts > 1) {
        console.log(`🔄 Retry attempt ${attempts - 1}/${suite.maxRetries}`);
      }

      try {
        const result = await this.executeScript(suite);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        const suiteResult = {
          ...result,
          suite: suite.name,
          script: suite.script,
          attempts,
          executionTime,
          critical: suite.critical,
          timestamp: new Date().toISOString()
        };

        this.results.suiteResults[suite.name] = suiteResult;

        if (result.success) {
          console.log(`✅ ${suite.name} PASSED`);
          console.log(`⏱️  Execution time: ${(executionTime / 1000).toFixed(1)}s`);
          this.results.summary.passedSuites++;
          return suiteResult;
        } else {
          console.log(`❌ ${suite.name} FAILED`);
          console.log(`⏱️  Execution time: ${(executionTime / 1000).toFixed(1)}s`);

          if (suite.retryOnFailure && attempts <= suite.maxRetries) {
            console.log(`🔄 Will retry (${suite.maxRetries - attempts + 1} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
            continue;
          } else {
            this.results.summary.failedSuites++;
            return suiteResult;
          }
        }

      } catch (error) {
        lastError = error;
        console.log(`💥 ${suite.name} ERRORED: ${error.message}`);

        if (suite.retryOnFailure && attempts <= suite.maxRetries) {
          console.log(`🔄 Will retry due to error (${suite.maxRetries - attempts + 1} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        } else {
          const endTime = performance.now();
          const executionTime = endTime - startTime;

          const suiteResult = {
            success: false,
            error: error.message,
            suite: suite.name,
            script: suite.script,
            attempts,
            executionTime,
            critical: suite.critical,
            timestamp: new Date().toISOString()
          };

          this.results.suiteResults[suite.name] = suiteResult;
          this.results.summary.failedSuites++;
          return suiteResult;
        }
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error(`Failed after ${attempts} attempts`);
  }

  async executeScript(suite) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(path.dirname(__filename), suite.script);

      console.log(`▶️  Executing: node ${suite.script}`);

      const process = spawn('node', [scriptPath], {
        cwd: path.dirname(scriptPath),
        env: process.env,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Stream output to console in real-time
        process.stdout.write(output);
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Stream errors to console in real-time
        process.stderr.write(output);
      });

      // Set timeout
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`Test suite timed out after ${suite.timeout / 1000} seconds`));
      }, suite.timeout);

      process.on('close', (code) => {
        clearTimeout(timeout);

        const result = {
          success: code === 0,
          exitCode: code,
          stdout,
          stderr,
          output: stdout + stderr
        };

        if (code === 0) {
          resolve(result);
        } else {
          resolve(result); // Still resolve with failure info rather than reject
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async stopMonitoring() {
    if (this.results.monitoring.pid) {
      console.log('\n🛑 Stopping background monitoring...');

      try {
        process.kill(this.results.monitoring.pid, 'SIGTERM');
        this.results.monitoring.status = 'stopped';
        this.results.monitoring.endTime = new Date().toISOString();
        console.log('✅ Monitoring stopped');
      } catch (error) {
        console.log(`⚠️  Could not stop monitoring: ${error.message}`);
        this.results.monitoring.status = 'stop-failed';
      }
    }
  }

  generateSummary() {
    const startTime = new Date(this.results.timestamp).getTime();
    const endTime = Date.now();
    this.results.summary.executionTime = endTime - startTime;

    this.results.summary.completedSuites = this.results.summary.passedSuites + this.results.summary.failedSuites;
    this.results.summary.overallPassRate = this.results.summary.totalSuites > 0 ?
      this.results.summary.passedSuites / this.results.summary.totalSuites : 0;

    // Analyze critical issues
    Object.values(this.results.suiteResults).forEach(result => {
      if (!result.success && result.critical) {
        this.results.summary.criticalIssues.push(`${result.suite}: ${result.error || 'Test failed'}`);
      } else if (!result.success && !result.critical) {
        this.results.summary.warnings.push(`${result.suite}: ${result.error || 'Test failed'}`);
      }
    });

    // Deployment recommendation
    const hascritical = this.results.summary.criticalIssues.length > 0;
    const passRate = this.results.summary.overallPassRate;

    if (hasCritical) {
      this.results.summary.deploymentRecommendation = 'do-not-deploy';
    } else if (passRate >= ORCHESTRATOR_CONFIG.deployment.approvalThreshold) {
      this.results.summary.deploymentRecommendation = ORCHESTRATOR_CONFIG.deployment.requireManualReview ?
        'manual-review-required' : 'approved';
    } else {
      this.results.summary.deploymentRecommendation = 'needs-improvement';
    }

    console.log('\n🏁 RAILWAY TEST ORCHESTRATION SUMMARY');
    console.log('=====================================');
    console.log(`📊 Overall Results:`);
    console.log(`   Total Suites: ${this.results.summary.totalSuites}`);
    console.log(`   Passed: ${this.results.summary.passedSuites} ✅`);
    console.log(`   Failed: ${this.results.summary.failedSuites} ❌`);
    console.log(`   Pass Rate: ${(passRate * 100).toFixed(1)}%`);
    console.log(`   Execution Time: ${(this.results.summary.executionTime / 1000 / 60).toFixed(1)} minutes`);
    console.log('');

    console.log(`🚀 Deployment Recommendation: ${this.results.summary.deploymentRecommendation.toUpperCase()}`);
    console.log('');

    // Show suite-by-suite results
    console.log('📋 Suite Results:');
    Object.values(this.results.suiteResults).forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const critical = result.critical ? '🚨' : '⚠️ ';
      const time = `${(result.executionTime / 1000).toFixed(1)}s`;

      console.log(`   ${status} ${critical} ${result.suite} (${time})`);

      if (!result.success && result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
    console.log('');

    // Critical issues
    if (this.results.summary.criticalIssues.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      this.results.summary.criticalIssues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
      console.log('');
    }

    // Warnings
    if (this.results.summary.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.results.summary.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
      console.log('');
    }

    // Monitoring status
    if (this.results.monitoring.started) {
      console.log(`🔍 Monitoring Status: ${this.results.monitoring.status}`);
      console.log('');
    }

    // Next steps
    console.log('📝 NEXT STEPS:');

    switch (this.results.summary.deploymentRecommendation) {
      case 'approved':
        console.log('   ✅ Deployment approved - proceed with Railway deployment');
        console.log('   📊 Monitor application performance after deployment');
        break;

      case 'manual-review-required':
        console.log('   👥 Manual review required before deployment');
        console.log('   📋 Review test results and stakeholder approval');
        console.log('   🚀 Proceed with deployment after approval');
        break;

      case 'needs-improvement':
        console.log('   🔧 Address test failures before deployment');
        console.log('   🔄 Re-run tests after fixes');
        console.log('   📊 Aim for 90%+ pass rate');
        break;

      case 'do-not-deploy':
        console.log('   🚫 DO NOT DEPLOY - Critical issues found');
        console.log('   🔧 Fix critical issues immediately');
        console.log('   🧪 Re-run full test suite after fixes');
        break;
    }

    return this.results.summary;
  }

  async generateMasterReport() {
    if (!ORCHESTRATOR_CONFIG.reporting.generateMasterReport) return;

    console.log('\n📄 Generating master test report...');

    const reportData = {
      orchestration: this.results,
      environment: this.results.environment,
      configuration: ORCHESTRATOR_CONFIG,
      generatedAt: new Date().toISOString()
    };

    // Save detailed JSON report
    const jsonReportPath = path.join(
      process.cwd(),
      'test-results/reports',
      `railway-master-report-${this.results.orchestrationId}.json`
    );

    fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(reportData);
    const htmlReportPath = path.join(
      process.cwd(),
      'test-results/reports',
      `railway-master-report-${this.results.orchestrationId}.html`
    );

    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`📊 JSON Report: ${jsonReportPath}`);
    console.log(`🌐 HTML Report: ${htmlReportPath}`);

    return {
      jsonReport: jsonReportPath,
      htmlReport: htmlReportPath
    };
  }

  generateHTMLReport(reportData) {
    const passRate = (reportData.orchestration.summary.overallPassRate * 100).toFixed(1);
    const recommendation = reportData.orchestration.summary.deploymentRecommendation;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Railway Test Report - ${reportData.orchestration.orchestrationId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { font-size: 0.9em; color: #666; text-transform: uppercase; }
        .suite-result { margin: 15px 0; padding: 15px; border-radius: 5px; }
        .suite-pass { background: #d4edda; border-left: 4px solid #28a745; }
        .suite-fail { background: #f8d7da; border-left: 4px solid #dc3545; }
        .critical { color: #dc3545; font-weight: bold; }
        .recommendation { padding: 20px; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .approved { background: #d4edda; color: #155724; }
        .manual-review { background: #fff3cd; color: #856404; }
        .needs-improvement { background: #f8d7da; color: #721c24; }
        .do-not-deploy { background: #f8d7da; color: #721c24; border: 2px solid #dc3545; }
        .issue { color: #dc3545; margin: 5px 0; }
        .warning { color: #856404; margin: 5px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Railway Deployment Test Report</h1>
            <p>Orchestration ID: ${reportData.orchestration.orchestrationId}</p>
            <p>Generated: ${reportData.generatedAt}</p>
        </div>

        <div class="content">
            <h2>📊 Test Summary</h2>

            <div class="metric">
                <div class="metric-value">${passRate}%</div>
                <div class="metric-label">Pass Rate</div>
            </div>

            <div class="metric">
                <div class="metric-value">${reportData.orchestration.summary.passedSuites}</div>
                <div class="metric-label">Passed</div>
            </div>

            <div class="metric">
                <div class="metric-value">${reportData.orchestration.summary.failedSuites}</div>
                <div class="metric-label">Failed</div>
            </div>

            <div class="metric">
                <div class="metric-value">${(reportData.orchestration.summary.executionTime / 1000 / 60).toFixed(1)}m</div>
                <div class="metric-label">Execution Time</div>
            </div>

            <div class="recommendation ${recommendation.replace(/-/g, '-')}">
                🚀 Deployment Recommendation: ${recommendation.replace(/-/g, ' ').toUpperCase()}
            </div>

            <h2>🧪 Test Suite Results</h2>
            ${Object.values(reportData.orchestration.suiteResults).map(result => `
                <div class="suite-result ${result.success ? 'suite-pass' : 'suite-fail'}">
                    <h3>${result.success ? '✅' : '❌'} ${result.suite} ${result.critical ? '<span class="critical">(Critical)</span>' : ''}</h3>
                    <p><strong>Script:</strong> ${result.script}</p>
                    <p><strong>Execution Time:</strong> ${(result.executionTime / 1000).toFixed(1)}s</p>
                    <p><strong>Attempts:</strong> ${result.attempts}</p>
                    ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
                    <p class="timestamp">Completed: ${result.timestamp}</p>
                </div>
            `).join('')}

            ${reportData.orchestration.summary.criticalIssues.length > 0 ? `
                <h2>🚨 Critical Issues</h2>
                ${reportData.orchestration.summary.criticalIssues.map(issue => `<div class="issue">• ${issue}</div>`).join('')}
            ` : ''}

            ${reportData.orchestration.summary.warnings.length > 0 ? `
                <h2>⚠️ Warnings</h2>
                ${reportData.orchestration.summary.warnings.map(warning => `<div class="warning">• ${warning}</div>`).join('')}
            ` : ''}

            <h2>🌐 Environment Information</h2>
            <p><strong>Railway URL:</strong> ${reportData.environment.railway}</p>
            <p><strong>Local URL:</strong> ${reportData.environment.local}</p>
            <p><strong>Node Version:</strong> ${reportData.environment.nodeVersion}</p>
            <p><strong>Platform:</strong> ${reportData.environment.platform}</p>

            ${reportData.orchestration.monitoring.started ? `
                <h2>🔍 Monitoring</h2>
                <p><strong>Status:</strong> ${reportData.orchestration.monitoring.status}</p>
                <p><strong>PID:</strong> ${reportData.orchestration.monitoring.pid}</p>
                <p><strong>Started:</strong> ${reportData.orchestration.monitoring.startTime}</p>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
  }

  async run() {
    const startTime = performance.now();

    try {
      await this.setup();

      // Start background monitoring
      await this.startMonitoring();

      // Run all test suites in sequence
      for (const suite of ORCHESTRATOR_CONFIG.suites) {
        await this.runTestSuite(suite);
        this.results.summary.completedSuites++;

        // Short pause between suites
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Stop monitoring
      await this.stopMonitoring();

      // Generate summary
      this.generateSummary();

      // Generate reports
      await this.generateMasterReport();

      const endTime = performance.now();
      console.log(`\n⏱️  Total orchestration time: ${((endTime - startTime) / 1000 / 60).toFixed(1)} minutes`);

      return this.results.summary.deploymentRecommendation !== 'do-not-deploy';

    } catch (error) {
      console.error('💥 Test orchestration failed:', error.message);

      // Stop monitoring if it was started
      await this.stopMonitoring();

      // Generate summary even on failure
      this.generateSummary();

      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🎭 Railway Test Suite Orchestrator

Usage: node scripts/railway-test-suite-orchestrator.js [options]

Options:
  --railway-url <url>    Railway deployment URL (default: from RAILWAY_STATIC_URL)
  --auto-approve         Auto-approve deployment if tests pass (default: false)
  --no-monitoring        Skip background monitoring (default: false)
  --help, -h             Show this help message

Environment Variables:
  RAILWAY_STATIC_URL      Railway deployment URL
  VITE_SUPABASE_URL      Supabase project URL
  VITE_SUPABASE_ANON_KEY Supabase anonymous key

Example:
  RAILWAY_STATIC_URL=https://myapp.railway.app node scripts/railway-test-suite-orchestrator.js

Test Suites Included:
  1. Railway Deployment Validation
  2. Railway Performance Benchmark
  3. Rollback Testing
  4. User Acceptance Testing
  5. Background Monitoring (continuous)
    `);
    return;
  }

  // Parse command line arguments
  const railwayUrlIndex = args.indexOf('--railway-url');
  if (railwayUrlIndex !== -1 && railwayUrlIndex + 1 < args.length) {
    process.env.RAILWAY_STATIC_URL = args[railwayUrlIndex + 1];
  }

  if (args.includes('--auto-approve')) {
    ORCHESTRATOR_CONFIG.deployment.requireManualReview = false;
  }

  if (args.includes('--no-monitoring')) {
    ORCHESTRATOR_CONFIG.monitoring.script = null;
  }

  console.log('🎬 Starting Railway Test Suite Orchestration...');
  console.log('');

  const orchestrator = new RailwayTestOrchestrator();
  const success = await orchestrator.run();

  console.log('\n🎬 Orchestration complete!');

  process.exit(success ? 0 : 1);
}

export { RailwayTestOrchestrator, ORCHESTRATOR_CONFIG };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Railway test orchestration failed:', error);
    process.exit(1);
  });
}