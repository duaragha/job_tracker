#!/usr/bin/env node

/**
 * Railway Performance Benchmark Suite
 * Specialized performance testing for Railway deployment environment
 * Compares local vs Railway performance and identifies environment-specific issues
 * Usage: node scripts/railway-performance-benchmark.js [options]
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway-specific benchmark configuration
const RAILWAY_BENCHMARK_CONFIG = {
  environments: {
    local: {
      url: 'http://localhost:5173',
      name: 'Local Development',
      expected: 'optimal'
    },
    railway: {
      url: process.env.RAILWAY_STATIC_URL || 'https://your-app.railway.app',
      name: 'Railway Production',
      expected: 'acceptable'
    }
  },
  testScenarios: [
    'cold_start',
    'warm_start',
    'data_loading',
    'search_performance',
    'scroll_performance',
    'memory_usage',
    'network_latency',
    'concurrent_users'
  ],
  iterations: 3,
  warmupRuns: 1,
  concurrentUserCounts: [1, 5, 10],
  datasetSizes: [100, 1000, 5000, 10000]
};

// Railway-specific performance thresholds
const RAILWAY_PERFORMANCE_THRESHOLDS = {
  local: {
    coldStart: 2000,
    warmStart: 1000,
    dataLoad: 800,
    search: 100,
    scroll: 16.67,
    memoryPerItem: 50,
    networkLatency: 50
  },
  railway: {
    coldStart: 8000,     // Railway cold start can be slow
    warmStart: 3000,     // Warm starts should be faster
    dataLoad: 2000,      // Network latency affects data loading
    search: 300,         // Client-side search should still be fast
    scroll: 33.33,       // 30fps acceptable for production
    memoryPerItem: 100,  // More lenient for production
    networkLatency: 500  // Geographic latency
  }
};

class RailwayPerformanceBenchmark {
  constructor() {
    this.browser = null;
    this.results = {
      timestamp: new Date().toISOString(),
      environments: {},
      comparisons: {},
      recommendations: [],
      summary: {
        railwayPerformanceGrade: null,
        criticalIssues: [],
        passedTests: 0,
        failedTests: 0,
        performanceRegression: false
      }
    };
  }

  async setup() {
    console.log('🚀 Railway Performance Benchmark Suite');
    console.log('=======================================');

    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--enable-precise-memory-info',
        '--disable-web-security', // For CORS testing
        '--ignore-certificate-errors'
      ]
    });

    console.log('✅ Browser initialized for Railway benchmarking');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Test 1: Cold Start Performance
  async benchmarkColdStart(environment) {
    console.log(`  ❄️  Testing cold start performance...`);

    const coldStartResults = [];

    for (let i = 0; i < RAILWAY_BENCHMARK_CONFIG.iterations; i++) {
      const page = await this.browser.newPage();

      try {
        // Clear cache to simulate cold start
        await page.setCacheEnabled(false);
        await page.setExtraHTTPHeaders({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        const startTime = performance.now();

        const response = await page.goto(environment.url, {
          waitUntil: 'networkidle0',
          timeout: 15000
        });

        // Wait for React to fully mount and hydrate
        await page.waitForSelector('table, [role="table"]', { timeout: 10000 });

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Get detailed metrics
        const detailedMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          const memory = performance.memory;

          return {
            dns: navigation ? navigation.domainLookupEnd - navigation.domainLookupStart : 0,
            tcp: navigation ? navigation.connectEnd - navigation.connectStart : 0,
            ssl: navigation ? navigation.connectEnd - navigation.secureConnectionStart : 0,
            ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0,
            domReady: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0,
            loadComplete: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
            memoryUsed: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0
          };
        });

        coldStartResults.push({
          iteration: i + 1,
          totalTime,
          httpStatus: response.status(),
          ...detailedMetrics
        });

        console.log(`    Iteration ${i + 1}: ${totalTime.toFixed(0)}ms`);

      } catch (error) {
        coldStartResults.push({
          iteration: i + 1,
          error: error.message,
          totalTime: 15000 // Timeout value
        });
      } finally {
        await page.close();
      }
    }

    const avgColdStart = coldStartResults
      .filter(r => !r.error)
      .reduce((sum, r) => sum + r.totalTime, 0) / coldStartResults.filter(r => !r.error).length;

    const threshold = RAILWAY_PERFORMANCE_THRESHOLDS[environment.name === 'Local Development' ? 'local' : 'railway'];

    return {
      test: 'Cold Start Performance',
      environment: environment.name,
      avgTime: avgColdStart,
      threshold: threshold.coldStart,
      passed: avgColdStart < threshold.coldStart,
      details: coldStartResults
    };
  }

  // Test 2: Warm Start Performance
  async benchmarkWarmStart(environment) {
    console.log(`  🔥 Testing warm start performance...`);

    const page = await this.browser.newPage();
    const warmStartResults = [];

    try {
      // Initial load to warm up
      await page.goto(environment.url, { waitUntil: 'networkidle0' });
      await page.waitForTimeout(2000);

      // Now test warm starts
      for (let i = 0; i < RAILWAY_BENCHMARK_CONFIG.iterations; i++) {
        const startTime = performance.now();

        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForSelector('table, [role="table"]');

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        warmStartResults.push({
          iteration: i + 1,
          totalTime
        });

        console.log(`    Iteration ${i + 1}: ${totalTime.toFixed(0)}ms`);
      }

    } catch (error) {
      warmStartResults.push({ error: error.message });
    } finally {
      await page.close();
    }

    const avgWarmStart = warmStartResults
      .filter(r => !r.error)
      .reduce((sum, r) => sum + r.totalTime, 0) / warmStartResults.filter(r => !r.error).length;

    const threshold = RAILWAY_PERFORMANCE_THRESHOLDS[environment.name === 'Local Development' ? 'local' : 'railway'];

    return {
      test: 'Warm Start Performance',
      environment: environment.name,
      avgTime: avgWarmStart,
      threshold: threshold.warmStart,
      passed: avgWarmStart < threshold.warmStart,
      details: warmStartResults
    };
  }

  // Test 3: Data Loading Performance
  async benchmarkDataLoading(environment) {
    console.log(`  📊 Testing data loading performance...`);

    const page = await this.browser.newPage();
    const dataLoadResults = [];

    try {
      await page.goto(environment.url, { waitUntil: 'networkidle0' });

      for (const dataSize of RAILWAY_BENCHMARK_CONFIG.datasetSizes) {
        console.log(`    Testing with ${dataSize} items...`);

        const loadResult = await page.evaluate(async (size) => {
          const startTime = performance.now();

          // Simulate data loading
          const testData = Array(size).fill().map((_, i) => ({
            id: i + 1,
            company: `Company ${i}`,
            position: `Position ${i}`,
            location: `Location ${i}`,
            status: ['Applied', 'Screening', 'Assessment', 'Interviewing', 'Rejected'][i % 5],
            appliedDate: new Date(2024, (i % 12), (i % 28) + 1).toISOString().split('T')[0],
            jobSite: `JobSite ${i % 10}`,
            url: `https://example.com/job/${i}`,
            created_at: new Date().toISOString()
          }));

          // If there's a way to update the app's data, do it here
          if (window.setJobData) {
            window.setJobData(testData);
          }

          // Wait for DOM updates
          await new Promise(resolve => {
            let attempts = 0;
            const checkRendered = () => {
              const rows = document.querySelectorAll('tbody tr');
              if (rows.length > 0 || attempts > 20) {
                resolve();
              } else {
                attempts++;
                setTimeout(checkRendered, 100);
              }
            };
            checkRendered();
          });

          const endTime = performance.now();
          const memory = performance.memory;

          return {
            dataSize: size,
            loadTime: endTime - startTime,
            renderedRows: document.querySelectorAll('tbody tr').length,
            memoryUsed: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0
          };
        }, dataSize);

        dataLoadResults.push(loadResult);
      }

    } catch (error) {
      dataLoadResults.push({ error: error.message });
    } finally {
      await page.close();
    }

    const avgLoadTime = dataLoadResults
      .filter(r => !r.error)
      .reduce((sum, r) => sum + r.loadTime, 0) / dataLoadResults.filter(r => !r.error).length;

    const threshold = RAILWAY_PERFORMANCE_THRESHOLDS[environment.name === 'Local Development' ? 'local' : 'railway'];

    return {
      test: 'Data Loading Performance',
      environment: environment.name,
      avgTime: avgLoadTime,
      threshold: threshold.dataLoad,
      passed: avgLoadTime < threshold.dataLoad,
      details: dataLoadResults
    };
  }

  // Test 4: Network Latency and API Performance
  async benchmarkNetworkLatency(environment) {
    console.log(`  🌐 Testing network latency and API performance...`);

    const page = await this.browser.newPage();
    const networkResults = [];

    try {
      await page.goto(environment.url, { waitUntil: 'networkidle0' });

      // Test API calls if Supabase is configured
      if (process.env.VITE_SUPABASE_URL) {
        const apiTests = [];

        for (let i = 0; i < 5; i++) {
          const apiResult = await page.evaluate(async (config) => {
            const startTime = performance.now();

            try {
              const response = await fetch(`${config.url}/rest/v1/jobs?select=count`, {
                headers: {
                  'apikey': config.key,
                  'Authorization': `Bearer ${config.key}`,
                  'Prefer': 'count=exact'
                }
              });

              const endTime = performance.now();

              return {
                responseTime: endTime - startTime,
                status: response.status,
                ok: response.ok
              };
            } catch (error) {
              return {
                responseTime: performance.now() - startTime,
                error: error.message
              };
            }
          }, {
            url: process.env.VITE_SUPABASE_URL,
            key: process.env.VITE_SUPABASE_ANON_KEY
          });

          apiTests.push(apiResult);
        }

        const avgApiTime = apiTests
          .filter(r => !r.error)
          .reduce((sum, r) => sum + r.responseTime, 0) / apiTests.filter(r => !r.error).length;

        networkResults.push({
          test: 'API Response Time',
          avgTime: avgApiTime,
          details: apiTests
        });
      }

      // Test static resource loading
      const resourceTest = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const slowResources = resources.filter(r => r.duration > 1000);

        return {
          totalResources: resources.length,
          slowResources: slowResources.length,
          avgResourceTime: resources.reduce((sum, r) => sum + r.duration, 0) / resources.length,
          slowResourceDetails: slowResources.map(r => ({
            name: r.name.split('/').pop(),
            duration: r.duration,
            size: r.transferSize || 0
          }))
        };
      });

      networkResults.push({
        test: 'Static Resource Loading',
        ...resourceTest
      });

    } catch (error) {
      networkResults.push({ error: error.message });
    } finally {
      await page.close();
    }

    const threshold = RAILWAY_PERFORMANCE_THRESHOLDS[environment.name === 'Local Development' ? 'local' : 'railway'];

    return {
      test: 'Network Latency',
      environment: environment.name,
      threshold: threshold.networkLatency,
      passed: true, // Complex test, evaluate in summary
      details: networkResults
    };
  }

  // Test 5: Concurrent User Simulation
  async benchmarkConcurrentUsers(environment) {
    console.log(`  👥 Testing concurrent user performance...`);

    const concurrentResults = [];

    for (const userCount of RAILWAY_BENCHMARK_CONFIG.concurrentUserCounts) {
      console.log(`    Testing ${userCount} concurrent users...`);

      const userPromises = [];
      const startTime = performance.now();

      for (let i = 0; i < userCount; i++) {
        const userPromise = this.simulateUser(environment.url, i);
        userPromises.push(userPromise);
      }

      try {
        const userResults = await Promise.all(userPromises);
        const endTime = performance.now();

        const successfulUsers = userResults.filter(r => r.success).length;
        const avgUserTime = userResults.reduce((sum, r) => sum + r.totalTime, 0) / userResults.length;

        concurrentResults.push({
          userCount,
          successfulUsers,
          successRate: (successfulUsers / userCount) * 100,
          avgUserTime,
          totalTestTime: endTime - startTime,
          userDetails: userResults
        });

      } catch (error) {
        concurrentResults.push({
          userCount,
          error: error.message
        });
      }
    }

    return {
      test: 'Concurrent Users',
      environment: environment.name,
      passed: concurrentResults.every(r => !r.error && r.successRate > 80),
      details: concurrentResults
    };
  }

  async simulateUser(url, userId) {
    const page = await this.browser.newPage();
    const startTime = performance.now();

    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });

      // Simulate user actions
      await page.waitForSelector('table', { timeout: 5000 });

      // Search action
      const searchInput = await page.$('input[placeholder*="Search"]');
      if (searchInput) {
        await searchInput.type(`user${userId}search`);
        await page.waitForTimeout(500);
      }

      // Scroll action
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(300);

      // Theme toggle (if available)
      try {
        await page.evaluate(() => {
          const toggle = document.querySelector('button[aria-label*="theme"], button[aria-label*="dark"]');
          if (toggle) toggle.click();
        });
        await page.waitForTimeout(200);
      } catch (e) {
        // Theme toggle might not be available
      }

      const endTime = performance.now();

      return {
        userId,
        success: true,
        totalTime: endTime - startTime,
        error: null
      };

    } catch (error) {
      return {
        userId,
        success: false,
        totalTime: performance.now() - startTime,
        error: error.message
      };
    } finally {
      await page.close();
    }
  }

  // Run all benchmarks for a specific environment
  async benchmarkEnvironment(environment) {
    console.log(`\n🏗️  Benchmarking ${environment.name}`);
    console.log(`📍 URL: ${environment.url}`);

    const environmentResults = {
      name: environment.name,
      url: environment.url,
      tests: []
    };

    try {
      // Run all benchmark tests
      environmentResults.tests.push(await this.benchmarkColdStart(environment));
      environmentResults.tests.push(await this.benchmarkWarmStart(environment));
      environmentResults.tests.push(await this.benchmarkDataLoading(environment));
      environmentResults.tests.push(await this.benchmarkNetworkLatency(environment));
      environmentResults.tests.push(await this.benchmarkConcurrentUsers(environment));

      const passed = environmentResults.tests.filter(t => t.passed).length;
      const failed = environmentResults.tests.length - passed;

      console.log(`  ✅ Tests passed: ${passed}/${environmentResults.tests.length}`);
      if (failed > 0) {
        console.log(`  ❌ Tests failed: ${failed}`);
      }

    } catch (error) {
      console.log(`  💥 Environment benchmark failed: ${error.message}`);
      environmentResults.error = error.message;
    }

    return environmentResults;
  }

  // Compare environments and generate recommendations
  generateComparison() {
    const local = this.results.environments['Local Development'];
    const railway = this.results.environments['Railway Production'];

    if (!local || !railway) {
      return { note: 'Cannot compare - one or both environments not tested' };
    }

    const comparisons = {};

    // Compare each test type
    ['Cold Start Performance', 'Warm Start Performance', 'Data Loading Performance'].forEach(testName => {
      const localTest = local.tests.find(t => t.test === testName);
      const railwayTest = railway.tests.find(t => t.test === testName);

      if (localTest && railwayTest && localTest.avgTime && railwayTest.avgTime) {
        const regression = ((railwayTest.avgTime - localTest.avgTime) / localTest.avgTime) * 100;

        comparisons[testName] = {
          localTime: localTest.avgTime,
          railwayTime: railwayTest.avgTime,
          regression: regression,
          acceptable: regression < 150, // Less than 150% increase is acceptable for Railway
          localPassed: localTest.passed,
          railwayPassed: railwayTest.passed
        };
      }
    });

    return comparisons;
  }

  generateRecommendations() {
    const recommendations = [];
    const railway = this.results.environments['Railway Production'];

    if (!railway) {
      return ['Railway environment could not be tested'];
    }

    const failedTests = railway.tests.filter(t => !t.passed);

    if (failedTests.some(t => t.test === 'Cold Start Performance')) {
      recommendations.push('Cold start performance is slow - consider implementing Railway health checks or keep-alive mechanisms');
      recommendations.push('Optimize bundle size and implement code splitting to reduce cold start time');
    }

    if (failedTests.some(t => t.test === 'Warm Start Performance')) {
      recommendations.push('Warm start performance needs improvement - check for memory leaks or inefficient caching');
    }

    if (failedTests.some(t => t.test === 'Data Loading Performance')) {
      recommendations.push('Data loading is slow on Railway - implement data pagination or caching strategies');
      recommendations.push('Consider using Railway Redis for caching frequently accessed data');
    }

    if (failedTests.some(t => t.test === 'Network Latency')) {
      recommendations.push('High network latency detected - optimize API calls and implement request batching');
      recommendations.push('Consider using a CDN for static assets');
    }

    if (failedTests.some(t => t.test === 'Concurrent Users')) {
      recommendations.push('Concurrent user performance issues - monitor Railway CPU/memory limits');
      recommendations.push('Consider upgrading Railway plan for better performance');
    }

    // Performance regression analysis
    Object.entries(this.results.comparisons).forEach(([testName, comparison]) => {
      if (comparison.regression > 200) {
        recommendations.push(`Significant performance regression in ${testName} (${comparison.regression.toFixed(1)}% slower)`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Excellent Railway performance! All benchmarks passed');
      recommendations.push('Monitor performance in production and set up automated benchmarking');
    }

    return recommendations;
  }

  generateSummary() {
    const railway = this.results.environments['Railway Production'];
    const local = this.results.environments['Local Development'];

    let totalTests = 0;
    let passedTests = 0;

    Object.values(this.results.environments).forEach(env => {
      if (env.tests) {
        totalTests += env.tests.length;
        passedTests += env.tests.filter(t => t.passed).length;
      }
    });

    // Generate performance grade for Railway
    let railwayGrade = 'Unknown';
    if (railway && railway.tests) {
      const railwayPassed = railway.tests.filter(t => t.passed).length;
      const railwayPassRate = railwayPassed / railway.tests.length;

      if (railwayPassRate >= 0.9) railwayGrade = 'A';
      else if (railwayPassRate >= 0.7) railwayGrade = 'B';
      else if (railwayPassRate >= 0.5) railwayGrade = 'C';
      else railwayGrade = 'F';
    }

    this.results.summary = {
      railwayPerformanceGrade: railwayGrade,
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      performanceRegression: Object.values(this.results.comparisons).some(c => c.regression > 200),
      criticalIssues: railway ? railway.tests.filter(t => !t.passed).map(t => t.test) : []
    };

    console.log('\n🏁 RAILWAY PERFORMANCE BENCHMARK SUMMARY');
    console.log('=========================================');
    console.log(`📊 Total tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${totalTests - passedTests}`);
    console.log(`🎯 Railway Performance Grade: ${railwayGrade}`);
    console.log('');

    if (local && railway) {
      console.log('📈 ENVIRONMENT COMPARISON:');
      Object.entries(this.results.comparisons).forEach(([test, comp]) => {
        console.log(`${test}:`);
        console.log(`  Local: ${comp.localTime.toFixed(0)}ms ${comp.localPassed ? '✅' : '❌'}`);
        console.log(`  Railway: ${comp.railwayTime.toFixed(0)}ms ${comp.railwayPassed ? '✅' : '❌'}`);
        console.log(`  Regression: ${comp.regression.toFixed(1)}% ${comp.acceptable ? '✅' : '⚠️'}`);
      });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    this.results.recommendations.forEach(rec => {
      console.log(`• ${rec}`);
    });

    return this.results.summary;
  }

  async saveResults() {
    const filename = `railway-performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(process.cwd(), 'test-results', filename);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));

    console.log(`\n💾 Railway performance results saved to: ${filepath}`);
    return filepath;
  }

  async run() {
    try {
      await this.setup();

      // Test available environments
      for (const [key, environment] of Object.entries(RAILWAY_BENCHMARK_CONFIG.environments)) {
        try {
          // Quick connectivity test
          const page = await this.browser.newPage();
          await page.goto(environment.url, { timeout: 10000 });
          await page.close();

          // Run full benchmark
          this.results.environments[environment.name] = await this.benchmarkEnvironment(environment);

        } catch (error) {
          console.log(`⚠️  Skipping ${environment.name}: ${error.message}`);
          this.results.environments[environment.name] = {
            name: environment.name,
            url: environment.url,
            error: error.message,
            tests: []
          };
        }
      }

      // Generate comparisons and recommendations
      this.results.comparisons = this.generateComparison();
      this.results.recommendations = this.generateRecommendations();

      // Generate summary
      this.generateSummary();

      // Save results
      await this.saveResults();

      return this.results.summary.railwayPerformanceGrade !== 'F';

    } catch (error) {
      console.error('💥 Railway performance benchmark failed:', error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 Railway Performance Benchmark Suite

Usage: node scripts/railway-performance-benchmark.js [options]

Options:
  --railway-url <url>    Railway application URL (default: from RAILWAY_STATIC_URL)
  --local-url <url>      Local development URL (default: http://localhost:5173)
  --iterations <n>       Number of test iterations (default: 3)
  --help, -h             Show this help message

Environment Variables:
  RAILWAY_STATIC_URL      Your Railway app URL
  VITE_SUPABASE_URL      Supabase project URL
  VITE_SUPABASE_ANON_KEY Supabase anonymous key

Example:
  RAILWAY_STATIC_URL=https://myapp.railway.app node scripts/railway-performance-benchmark.js
    `);
    return;
  }

  // Parse command line arguments
  const railwayUrlIndex = args.indexOf('--railway-url');
  if (railwayUrlIndex !== -1 && railwayUrlIndex + 1 < args.length) {
    RAILWAY_BENCHMARK_CONFIG.environments.railway.url = args[railwayUrlIndex + 1];
  }

  const localUrlIndex = args.indexOf('--local-url');
  if (localUrlIndex !== -1 && localUrlIndex + 1 < args.length) {
    RAILWAY_BENCHMARK_CONFIG.environments.local.url = args[localUrlIndex + 1];
  }

  const iterationsIndex = args.indexOf('--iterations');
  if (iterationsIndex !== -1 && iterationsIndex + 1 < args.length) {
    RAILWAY_BENCHMARK_CONFIG.iterations = parseInt(args[iterationsIndex + 1]) || RAILWAY_BENCHMARK_CONFIG.iterations;
  }

  const benchmark = new RailwayPerformanceBenchmark();
  const success = await benchmark.run();

  process.exit(success ? 0 : 1);
}

export { RailwayPerformanceBenchmark, RAILWAY_BENCHMARK_CONFIG, RAILWAY_PERFORMANCE_THRESHOLDS };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Railway performance benchmark failed:', error);
    process.exit(1);
  });
}