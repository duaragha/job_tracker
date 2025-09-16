#!/usr/bin/env node

/**
 * Monitoring and Health Check Implementation
 * Continuous monitoring system for Railway deployment
 * Real-time health checks, performance monitoring, and alerting
 * Usage: node scripts/monitoring-health-checks.js [options]
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Monitoring configuration
const MONITORING_CONFIG = {
  targets: {
    primary: process.env.RAILWAY_STATIC_URL || 'https://your-app.railway.app',
    fallback: process.env.FALLBACK_URL || 'http://localhost:5173',
    api: process.env.VITE_SUPABASE_URL || null
  },
  intervals: {
    healthCheck: 30000,      // 30 seconds
    performanceCheck: 60000, // 1 minute
    deepCheck: 300000,       // 5 minutes
    alertCheck: 5000         // 5 seconds for alerts
  },
  thresholds: {
    responseTime: 5000,      // 5 seconds max response time
    errorRate: 0.05,         // 5% max error rate
    memoryUsage: 512,        // 512MB max memory
    cpuUsage: 80,            // 80% max CPU (simulated)
    diskSpace: 90,           // 90% max disk usage
    consecutiveFailures: 3   // Alert after 3 consecutive failures
  },
  alerts: {
    webhook: process.env.WEBHOOK_URL || null,
    email: process.env.ALERT_EMAIL || null,
    slack: process.env.SLACK_WEBHOOK || null
  },
  retention: {
    metrics: 24 * 60 * 60 * 1000,  // 24 hours
    logs: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
};

class MonitoringSystem {
  constructor() {
    this.browser = null;
    this.isRunning = false;
    this.metrics = {
      uptime: {
        startTime: Date.now(),
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        consecutiveFailures: 0,
        lastSuccessfulCheck: null,
        lastFailure: null
      },
      performance: {
        responseTimeHistory: [],
        memoryUsageHistory: [],
        errorRateHistory: [],
        lastPerformanceCheck: null
      },
      alerts: {
        totalAlerts: 0,
        alertHistory: [],
        lastAlert: null,
        suppressedAlerts: 0
      }
    };
    this.healthCheckInterval = null;
    this.performanceInterval = null;
    this.deepCheckInterval = null;
  }

  async setup() {
    console.log('🔍 Railway Monitoring and Health Check System');
    console.log('==============================================');

    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--enable-precise-memory-info'
      ]
    });

    // Ensure monitoring directories exist
    this.ensureDirectories();

    // Load previous metrics if available
    this.loadMetrics();

    console.log('✅ Monitoring system initialized');
    console.log(`📍 Primary target: ${MONITORING_CONFIG.targets.primary}`);
    console.log(`⏱️  Health check interval: ${MONITORING_CONFIG.intervals.healthCheck / 1000}s`);
    console.log('');
  }

  async cleanup() {
    this.isRunning = false;

    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.performanceInterval) clearInterval(this.performanceInterval);
    if (this.deepCheckInterval) clearInterval(this.deepCheckInterval);

    if (this.browser) {
      await this.browser.close();
    }

    // Save final metrics
    this.saveMetrics();
  }

  ensureDirectories() {
    const dirs = ['monitoring', 'monitoring/logs', 'monitoring/metrics', 'monitoring/alerts'];
    dirs.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  loadMetrics() {
    const metricsFile = path.join(process.cwd(), 'monitoring/metrics/current.json');
    if (fs.existsSync(metricsFile)) {
      try {
        const savedMetrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
        // Merge with current metrics, preserving structure
        this.metrics = { ...this.metrics, ...savedMetrics };
        console.log('📊 Loaded previous metrics');
      } catch (error) {
        console.log('⚠️  Could not load previous metrics:', error.message);
      }
    }
  }

  saveMetrics() {
    const metricsFile = path.join(process.cwd(), 'monitoring/metrics/current.json');
    try {
      fs.writeFileSync(metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('❌ Could not save metrics:', error.message);
    }
  }

  // Basic Health Check
  async performHealthCheck() {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const page = await this.browser.newPage();

      try {
        // Set timeout for health check
        page.setDefaultTimeout(MONITORING_CONFIG.thresholds.responseTime);

        const response = await page.goto(MONITORING_CONFIG.targets.primary, {
          waitUntil: 'networkidle0',
          timeout: MONITORING_CONFIG.thresholds.responseTime
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // Check page health
        const healthStatus = await page.evaluate(() => {
          return {
            title: document.title,
            hasContent: document.body.textContent.trim().length > 100,
            hasTable: !!document.querySelector('table, [role="table"]'),
            hasSearch: !!document.querySelector('input[placeholder*="Search"]'),
            hasErrors: document.body.textContent.toLowerCase().includes('error') ||
                      document.body.textContent.toLowerCase().includes('failed'),
            readyState: document.readyState,
            memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0
          };
        });

        const isHealthy = response.status() === 200 &&
                         healthStatus.hasContent &&
                         !healthStatus.hasErrors &&
                         responseTime < MONITORING_CONFIG.thresholds.responseTime;

        const checkResult = {
          timestamp,
          healthy: isHealthy,
          responseTime,
          httpStatus: response.status(),
          ...healthStatus
        };

        // Update metrics
        this.updateUptimeMetrics(isHealthy, responseTime, checkResult);

        // Log result
        this.logHealthCheck(checkResult);

        return checkResult;

      } finally {
        await page.close();
      }

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const checkResult = {
        timestamp,
        healthy: false,
        responseTime,
        error: error.message,
        errorType: error.name
      };

      this.updateUptimeMetrics(false, responseTime, checkResult);
      this.logHealthCheck(checkResult);

      return checkResult;
    }
  }

  // Performance Monitoring
  async performPerformanceCheck() {
    console.log('📊 Performing performance check...');

    try {
      const page = await this.browser.newPage();

      try {
        // Enable performance monitoring
        await page.setCacheEnabled(false);

        const startTime = performance.now();

        await page.goto(MONITORING_CONFIG.targets.primary, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        const loadTime = performance.now() - startTime;

        // Get detailed performance metrics
        const perfMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          const memory = performance.memory;
          const resources = performance.getEntriesByType('resource');

          // Calculate resource metrics
          let totalResourceSize = 0;
          let slowResources = 0;

          resources.forEach(resource => {
            if (resource.transferSize) {
              totalResourceSize += resource.transferSize;
            }
            if (resource.duration > 1000) {
              slowResources++;
            }
          });

          return {
            loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : loadTime,
            domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0,
            firstContentfulPaint: 0, // Would need additional setup
            memoryUsed: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
            totalMemory: memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024) : 0,
            resourceCount: resources.length,
            totalResourceSize: Math.round(totalResourceSize / 1024), // KB
            slowResources,
            jsErrors: 0 // Would need error tracking setup
          };
        });

        // Test interactive features
        const interactivityTest = await this.testInteractivity(page);

        const performanceResult = {
          timestamp: new Date().toISOString(),
          ...perfMetrics,
          interactivity: interactivityTest,
          grade: this.calculatePerformanceGrade(perfMetrics, interactivityTest)
        };

        // Update performance metrics
        this.updatePerformanceMetrics(performanceResult);

        // Log performance
        this.logPerformanceCheck(performanceResult);

        return performanceResult;

      } finally {
        await page.close();
      }

    } catch (error) {
      const performanceResult = {
        timestamp: new Date().toISOString(),
        error: error.message,
        grade: 'F'
      };

      this.logPerformanceCheck(performanceResult);
      return performanceResult;
    }
  }

  async testInteractivity(page) {
    try {
      // Test search functionality
      const searchTest = await page.evaluate(async () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (!searchInput) return { searchAvailable: false };

        const startTime = performance.now();
        searchInput.value = 'test search';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Wait a bit for debouncing
        await new Promise(resolve => setTimeout(resolve, 300));

        const endTime = performance.now();

        return {
          searchAvailable: true,
          searchResponseTime: endTime - startTime
        };
      });

      // Test theme toggle
      const themeTest = await page.evaluate(async () => {
        const themeToggle = document.querySelector('button[aria-label*="theme"], button[aria-label*="dark"]');
        if (!themeToggle) return { themeToggleAvailable: false };

        const startTime = performance.now();
        themeToggle.click();

        await new Promise(resolve => setTimeout(resolve, 500));

        const endTime = performance.now();

        return {
          themeToggleAvailable: true,
          themeToggleResponseTime: endTime - startTime
        };
      });

      // Test scrolling performance
      const scrollTest = await page.evaluate(async () => {
        const startTime = performance.now();

        window.scrollTo(0, 1000);
        await new Promise(resolve => setTimeout(resolve, 100));
        window.scrollTo(0, 0);

        const endTime = performance.now();

        return {
          scrollResponseTime: endTime - startTime
        };
      });

      return {
        ...searchTest,
        ...themeTest,
        ...scrollTest,
        overall: 'responsive'
      };

    } catch (error) {
      return {
        error: error.message,
        overall: 'unresponsive'
      };
    }
  }

  // Deep System Check
  async performDeepCheck() {
    console.log('🔬 Performing deep system check...');

    const deepCheckResults = {
      timestamp: new Date().toISOString(),
      apiConnectivity: null,
      databaseHealth: null,
      securityCheck: null,
      integrationTests: null
    };

    // Test API connectivity
    if (MONITORING_CONFIG.targets.api) {
      deepCheckResults.apiConnectivity = await this.testAPIConnectivity();
    }

    // Test database health
    deepCheckResults.databaseHealth = await this.testDatabaseHealth();

    // Test security headers
    deepCheckResults.securityCheck = await this.testSecurityHeaders();

    // Test critical user flows
    deepCheckResults.integrationTests = await this.testCriticalFlows();

    this.logDeepCheck(deepCheckResults);
    return deepCheckResults;
  }

  async testAPIConnectivity() {
    if (!MONITORING_CONFIG.targets.api) {
      return { status: 'skipped', reason: 'No API URL configured' };
    }

    try {
      const page = await this.browser.newPage();

      const apiTest = await page.evaluate(async (config) => {
        try {
          const startTime = performance.now();

          const response = await fetch(`${config.url}/rest/v1/`, {
            method: 'HEAD',
            headers: {
              'apikey': config.key,
              'Authorization': `Bearer ${config.key}`
            }
          });

          const endTime = performance.now();

          return {
            connected: response.ok,
            responseTime: endTime - startTime,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
          };

        } catch (error) {
          return {
            connected: false,
            error: error.message
          };
        }
      }, {
        url: MONITORING_CONFIG.targets.api,
        key: process.env.VITE_SUPABASE_ANON_KEY
      });

      await page.close();
      return apiTest;

    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  async testDatabaseHealth() {
    try {
      const page = await this.browser.newPage();
      await page.goto(MONITORING_CONFIG.targets.primary);

      const dbTest = await page.evaluate(async () => {
        // Test if data loads properly
        const hasData = document.querySelectorAll('tbody tr').length > 0;
        const hasErrorMessages = document.body.textContent.toLowerCase().includes('database error') ||
                                document.body.textContent.toLowerCase().includes('connection failed');

        return {
          dataLoaded: hasData,
          hasErrors: hasErrorMessages,
          healthy: hasData && !hasErrorMessages
        };
      });

      await page.close();
      return dbTest;

    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async testSecurityHeaders() {
    try {
      const page = await this.browser.newPage();
      const response = await page.goto(MONITORING_CONFIG.targets.primary);

      const headers = response.headers();

      const securityHeaders = {
        'strict-transport-security': headers['strict-transport-security'] || null,
        'x-content-type-options': headers['x-content-type-options'] || null,
        'x-frame-options': headers['x-frame-options'] || null,
        'referrer-policy': headers['referrer-policy'] || null,
        'content-security-policy': headers['content-security-policy'] || null
      };

      const securityScore = Object.values(securityHeaders).filter(h => h !== null).length;

      await page.close();

      return {
        headers: securityHeaders,
        score: securityScore,
        maxScore: 5,
        secure: securityScore >= 2
      };

    } catch (error) {
      return {
        secure: false,
        error: error.message
      };
    }
  }

  async testCriticalFlows() {
    try {
      const page = await this.browser.newPage();
      await page.goto(MONITORING_CONFIG.targets.primary);

      // Test search flow
      const searchFlow = await page.evaluate(async () => {
        try {
          const searchInput = document.querySelector('input[placeholder*="Search"]');
          if (!searchInput) return { searchFlow: false, reason: 'Search input not found' };

          searchInput.value = 'Software Engineer';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));

          await new Promise(resolve => setTimeout(resolve, 500));

          return { searchFlow: true };
        } catch (error) {
          return { searchFlow: false, error: error.message };
        }
      });

      // Test theme toggle flow
      const themeFlow = await page.evaluate(async () => {
        try {
          const themeToggle = document.querySelector('button[aria-label*="theme"], button[aria-label*="dark"]');
          if (!themeToggle) return { themeFlow: false, reason: 'Theme toggle not found' };

          themeToggle.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          return { themeFlow: true };
        } catch (error) {
          return { themeFlow: false, error: error.message };
        }
      });

      await page.close();

      const flowTests = { ...searchFlow, ...themeFlow };
      const passedFlows = Object.values(flowTests).filter(v => v === true).length;

      return {
        ...flowTests,
        passedFlows,
        totalFlows: 2,
        healthy: passedFlows >= 1
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  // Metric Updates
  updateUptimeMetrics(isHealthy, responseTime, checkResult) {
    this.metrics.uptime.totalChecks++;

    if (isHealthy) {
      this.metrics.uptime.successfulChecks++;
      this.metrics.uptime.consecutiveFailures = 0;
      this.metrics.uptime.lastSuccessfulCheck = checkResult.timestamp;
    } else {
      this.metrics.uptime.failedChecks++;
      this.metrics.uptime.consecutiveFailures++;
      this.metrics.uptime.lastFailure = checkResult.timestamp;

      // Check if we need to send an alert
      if (this.metrics.uptime.consecutiveFailures >= MONITORING_CONFIG.thresholds.consecutiveFailures) {
        this.sendAlert('consecutive-failures', checkResult);
      }
    }

    // Add to response time history
    this.metrics.performance.responseTimeHistory.push({
      timestamp: checkResult.timestamp,
      responseTime
    });

    // Trim history to retention period
    this.trimHistory();

    // Check thresholds
    this.checkThresholds(checkResult);
  }

  updatePerformanceMetrics(performanceResult) {
    this.metrics.performance.lastPerformanceCheck = performanceResult.timestamp;

    if (performanceResult.memoryUsed) {
      this.metrics.performance.memoryUsageHistory.push({
        timestamp: performanceResult.timestamp,
        memoryUsed: performanceResult.memoryUsed
      });
    }

    // Calculate error rate
    const recentChecks = this.metrics.uptime.totalChecks > 0 ?
      Math.min(this.metrics.uptime.totalChecks, 100) : 1;
    const recentFailures = Math.min(this.metrics.uptime.failedChecks, recentChecks);
    const errorRate = recentFailures / recentChecks;

    this.metrics.performance.errorRateHistory.push({
      timestamp: performanceResult.timestamp,
      errorRate
    });

    this.trimHistory();
  }

  trimHistory() {
    const now = Date.now();
    const retentionPeriod = MONITORING_CONFIG.retention.metrics;

    // Trim response time history
    this.metrics.performance.responseTimeHistory = this.metrics.performance.responseTimeHistory.filter(
      entry => (now - new Date(entry.timestamp).getTime()) < retentionPeriod
    );

    // Trim memory usage history
    this.metrics.performance.memoryUsageHistory = this.metrics.performance.memoryUsageHistory.filter(
      entry => (now - new Date(entry.timestamp).getTime()) < retentionPeriod
    );

    // Trim error rate history
    this.metrics.performance.errorRateHistory = this.metrics.performance.errorRateHistory.filter(
      entry => (now - new Date(entry.timestamp).getTime()) < retentionPeriod
    );
  }

  checkThresholds(checkResult) {
    // Response time threshold
    if (checkResult.responseTime > MONITORING_CONFIG.thresholds.responseTime) {
      this.sendAlert('slow-response', checkResult);
    }

    // Memory threshold
    if (checkResult.memoryUsage > MONITORING_CONFIG.thresholds.memoryUsage) {
      this.sendAlert('high-memory', checkResult);
    }
  }

  calculatePerformanceGrade(perfMetrics, interactivityTest) {
    let score = 100;

    // Deduct for slow load time
    if (perfMetrics.loadTime > 3000) score -= 20;
    else if (perfMetrics.loadTime > 2000) score -= 10;

    // Deduct for high memory usage
    if (perfMetrics.memoryUsed > 200) score -= 15;
    else if (perfMetrics.memoryUsed > 100) score -= 5;

    // Deduct for poor interactivity
    if (interactivityTest.overall === 'unresponsive') score -= 25;
    else if (interactivityTest.searchResponseTime > 500) score -= 10;

    // Deduct for slow resources
    if (perfMetrics.slowResources > 5) score -= 15;
    else if (perfMetrics.slowResources > 2) score -= 5;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Alerting System
  async sendAlert(type, details) {
    const alert = {
      type,
      timestamp: new Date().toISOString(),
      details,
      severity: this.getAlertSeverity(type),
      target: MONITORING_CONFIG.targets.primary
    };

    this.metrics.alerts.totalAlerts++;
    this.metrics.alerts.alertHistory.push(alert);
    this.metrics.alerts.lastAlert = alert.timestamp;

    // Log alert
    this.logAlert(alert);

    // Send notifications (if configured)
    await this.sendNotifications(alert);

    console.log(`🚨 ALERT: ${type.toUpperCase()} - ${alert.severity}`);
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }

  getAlertSeverity(type) {
    const severityMap = {
      'consecutive-failures': 'CRITICAL',
      'slow-response': 'WARNING',
      'high-memory': 'WARNING',
      'api-failure': 'HIGH',
      'database-failure': 'CRITICAL',
      'security-issue': 'HIGH'
    };

    return severityMap[type] || 'INFO';
  }

  async sendNotifications(alert) {
    // Webhook notification
    if (MONITORING_CONFIG.alerts.webhook) {
      try {
        const response = await fetch(MONITORING_CONFIG.alerts.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });

        if (!response.ok) {
          console.log('⚠️  Webhook notification failed');
        }
      } catch (error) {
        console.log('⚠️  Webhook notification error:', error.message);
      }
    }

    // Additional notification methods could be added here
    // (email, Slack, Discord, etc.)
  }

  // Logging
  logHealthCheck(result) {
    const logEntry = {
      timestamp: result.timestamp,
      type: 'health-check',
      ...result
    };

    this.writeLog('health', logEntry);

    // Console output
    const status = result.healthy ? '✅' : '❌';
    const responseTime = result.responseTime ? `${result.responseTime.toFixed(0)}ms` : 'N/A';
    console.log(`${status} Health Check - ${responseTime} - ${result.timestamp}`);
  }

  logPerformanceCheck(result) {
    const logEntry = {
      timestamp: result.timestamp,
      type: 'performance-check',
      ...result
    };

    this.writeLog('performance', logEntry);

    console.log(`📊 Performance Check - Grade: ${result.grade} - ${result.timestamp}`);
  }

  logDeepCheck(result) {
    const logEntry = {
      timestamp: result.timestamp,
      type: 'deep-check',
      ...result
    };

    this.writeLog('deep', logEntry);

    console.log(`🔬 Deep Check - ${result.timestamp}`);
  }

  logAlert(alert) {
    const logEntry = {
      timestamp: alert.timestamp,
      type: 'alert',
      ...alert
    };

    this.writeLog('alerts', logEntry);
  }

  writeLog(logType, logEntry) {
    const logDir = path.join(process.cwd(), 'monitoring/logs');
    const logFile = path.join(logDir, `${logType}-${new Date().toISOString().split('T')[0]}.json`);

    try {
      let logs = [];
      if (fs.existsSync(logFile)) {
        const existingContent = fs.readFileSync(logFile, 'utf8');
        logs = existingContent ? JSON.parse(existingContent) : [];
      }

      logs.push(logEntry);
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

    } catch (error) {
      console.error(`❌ Could not write ${logType} log:`, error.message);
    }
  }

  // Status Dashboard
  generateStatusReport() {
    const now = Date.now();
    const uptimeMs = now - this.metrics.uptime.startTime;
    const uptimeHours = (uptimeMs / (1000 * 60 * 60)).toFixed(1);

    const successRate = this.metrics.uptime.totalChecks > 0 ?
      ((this.metrics.uptime.successfulChecks / this.metrics.uptime.totalChecks) * 100).toFixed(2) :
      '0.00';

    const avgResponseTime = this.metrics.performance.responseTimeHistory.length > 0 ?
      (this.metrics.performance.responseTimeHistory.reduce((sum, entry) => sum + entry.responseTime, 0) /
       this.metrics.performance.responseTimeHistory.length).toFixed(0) :
      'N/A';

    const currentMemory = this.metrics.performance.memoryUsageHistory.length > 0 ?
      this.metrics.performance.memoryUsageHistory[this.metrics.performance.memoryUsageHistory.length - 1].memoryUsed :
      'N/A';

    console.log('\n📊 MONITORING STATUS DASHBOARD');
    console.log('==============================');
    console.log(`🎯 Target: ${MONITORING_CONFIG.targets.primary}`);
    console.log(`⏱️  Monitoring duration: ${uptimeHours} hours`);
    console.log(`✅ Success rate: ${successRate}%`);
    console.log(`📈 Total checks: ${this.metrics.uptime.totalChecks}`);
    console.log(`❌ Failed checks: ${this.metrics.uptime.failedChecks}`);
    console.log(`🔄 Consecutive failures: ${this.metrics.uptime.consecutiveFailures}`);
    console.log(`⚡ Average response time: ${avgResponseTime}ms`);
    console.log(`💾 Current memory usage: ${currentMemory}MB`);
    console.log(`🚨 Total alerts: ${this.metrics.alerts.totalAlerts}`);
    console.log(`📅 Last successful check: ${this.metrics.uptime.lastSuccessfulCheck || 'None'}`);
    console.log('');
  }

  // Main monitoring loop
  async startMonitoring() {
    console.log('🚀 Starting continuous monitoring...');
    console.log('Press Ctrl+C to stop monitoring');
    console.log('');

    this.isRunning = true;

    // Initial health check
    await this.performHealthCheck();

    // Set up intervals
    this.healthCheckInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performHealthCheck();
      }
    }, MONITORING_CONFIG.intervals.healthCheck);

    this.performanceInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performPerformanceCheck();
      }
    }, MONITORING_CONFIG.intervals.performanceCheck);

    this.deepCheckInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performDeepCheck();
      }
    }, MONITORING_CONFIG.intervals.deepCheck);

    // Status report interval
    setInterval(() => {
      if (this.isRunning) {
        this.generateStatusReport();
        this.saveMetrics();
      }
    }, 300000); // Every 5 minutes

    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping monitoring...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Stopping monitoring...');
      await this.cleanup();
      process.exit(0);
    });

    // Keep alive
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async run() {
    try {
      await this.setup();
      await this.startMonitoring();
    } catch (error) {
      console.error('💥 Monitoring system failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Railway Monitoring and Health Check System

Usage: node scripts/monitoring-health-checks.js [options]

Options:
  --target <url>         Primary target URL (default: from RAILWAY_STATIC_URL)
  --interval <seconds>   Health check interval (default: 30)
  --help, -h             Show this help message

Environment Variables:
  RAILWAY_STATIC_URL      Primary monitoring target
  FALLBACK_URL           Fallback target for comparison
  VITE_SUPABASE_URL      API endpoint to monitor
  WEBHOOK_URL            Webhook for alerts
  ALERT_EMAIL            Email for alerts
  SLACK_WEBHOOK          Slack webhook for alerts

Example:
  RAILWAY_STATIC_URL=https://myapp.railway.app node scripts/monitoring-health-checks.js
    `);
    return;
  }

  // Parse command line arguments
  const targetIndex = args.indexOf('--target');
  if (targetIndex !== -1 && targetIndex + 1 < args.length) {
    MONITORING_CONFIG.targets.primary = args[targetIndex + 1];
  }

  const intervalIndex = args.indexOf('--interval');
  if (intervalIndex !== -1 && intervalIndex + 1 < args.length) {
    const intervalSeconds = parseInt(args[intervalIndex + 1]);
    if (intervalSeconds > 0) {
      MONITORING_CONFIG.intervals.healthCheck = intervalSeconds * 1000;
    }
  }

  const monitor = new MonitoringSystem();
  await monitor.run();
}

export { MonitoringSystem, MONITORING_CONFIG };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Monitoring system failed:', error);
    process.exit(1);
  });
}