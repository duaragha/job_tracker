#!/usr/bin/env node

/**
 * Stress Testing Suite for Job Tracker Application
 * Tests edge cases, large datasets, and system limits
 * Usage: node scripts/stress-tests.js [options]
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { PERFORMANCE_CRITERIA, TEST_SCENARIOS } from './performance-criteria.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stress test configuration
const STRESS_CONFIG = {
  url: 'http://localhost:5173',
  datasets: {
    small: 100,
    medium: 1000,
    large: 10000,
    xlarge: 25000,
    massive: 50000,
    extreme: 100000
  },
  concurrentUsers: [1, 5, 10, 25, 50],
  testDuration: 60000, // 1 minute
  rampUpTime: 10000,   // 10 seconds
  memoryTestDuration: 300000, // 5 minutes
  rapidInteractionCount: 1000,
  searchStressCount: 500
};

class StressTester {
  constructor() {
    this.browser = null;
    this.results = {
      timestamp: new Date().toISOString(),
      testResults: [],
      summary: {},
      criticalIssues: [],
      recommendations: []
    };
  }

  async setup() {
    console.log('🚀 Initializing Stress Test Suite');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--enable-precise-memory-info',
        '--max-old-space-size=8192' // Allow more memory for stress tests
      ]
    });

    console.log('✅ Browser initialized for stress testing');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Test 1: Massive Dataset Loading
  async testMassiveDatasetLoad() {
    console.log('\n💾 STRESS TEST: Massive Dataset Loading');
    
    const results = {};
    
    for (const [name, size] of Object.entries(STRESS_CONFIG.datasets)) {
      console.log(`  📊 Testing dataset size: ${size.toLocaleString()} records (${name})`);
      
      const page = await this.browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      try {
        // Inject test data generator
        await page.evaluateOnNewDocument((dataSize) => {
          window.STRESS_TEST_DATA_SIZE = dataSize;
          window.generateStressTestData = () => {
            console.log(`Generating ${dataSize} test records...`);
            const jobs = [];
            
            for (let i = 0; i < dataSize; i++) {
              jobs.push({
                id: i + 1,
                company: `Company ${i % 100}`,
                position: `Position ${i % 50}`,
                location: `Location ${i % 25}`,
                status: ['Applied', 'Screening', 'Assessment', 'Interviewing', 'Rejected'][i % 5],
                appliedDate: new Date(2024, (i % 12), (i % 28) + 1).toISOString().split('T')[0],
                rejectionDate: i % 7 === 0 ? new Date(2024, (i % 12), (i % 28) + 5).toISOString().split('T')[0] : null,
                jobSite: `JobSite ${i % 10}`,
                url: `https://example.com/job/${i}`,
                created_at: new Date().toISOString()
              });
            }
            
            return jobs;
          };
        }, size);

        const startTime = performance.now();
        
        // Navigate and wait for load
        await page.goto(STRESS_CONFIG.url, { 
          waitUntil: 'networkidle0',
          timeout: 60000 
        });

        // Simulate data loading
        const loadResult = await page.evaluate(async () => {
          const testData = window.generateStressTestData();
          const startTime = performance.now();
          
          // Simulate React state update with large dataset
          if (window.React && window.setJobs) {
            window.setJobs(testData);
          }
          
          // Wait for DOM updates
          await new Promise(resolve => {
            let attempts = 0;
            const checkRendered = () => {
              const rows = document.querySelectorAll('tbody tr');
              if (rows.length > 0 || attempts > 50) {
                resolve();
              } else {
                attempts++;
                setTimeout(checkRendered, 100);
              }
            };
            checkRendered();
          });
          
          const endTime = performance.now();
          const memoryInfo = performance.memory || {};
          
          return {
            loadTime: endTime - startTime,
            memoryUsed: memoryInfo.usedJSHeapSize || 0,
            totalMemory: memoryInfo.totalJSHeapSize || 0,
            renderedRows: document.querySelectorAll('tbody tr').length,
            dataSize: testData.length
          };
        });

        const totalTime = performance.now() - startTime;

        results[name] = {
          size,
          loadTime: totalTime,
          renderTime: loadResult.loadTime,
          memoryUsed: Math.round(loadResult.memoryUsed / 1024 / 1024),
          totalMemory: Math.round(loadResult.totalMemory / 1024 / 1024),
          renderedRows: loadResult.renderedRows,
          success: totalTime < (size > 10000 ? 15000 : 8000),
          memoryEfficient: loadResult.memoryUsed / size < 1000 // < 1KB per item
        };

        console.log(`    ⏱️  Load time: ${totalTime.toFixed(0)}ms`);
        console.log(`    💾 Memory used: ${results[name].memoryUsed}MB`);
        console.log(`    📊 Rows rendered: ${loadResult.renderedRows}`);
        console.log(`    ${results[name].success ? '✅' : '❌'} ${results[name].success ? 'PASSED' : 'FAILED'}`);

      } catch (error) {
        console.log(`    ❌ FAILED: ${error.message}`);
        results[name] = {
          size,
          error: error.message,
          success: false
        };
      } finally {
        await page.close();
      }
    }

    this.results.testResults.push({
      testName: 'Massive Dataset Loading',
      results,
      passed: Object.values(results).filter(r => r.success).length,
      failed: Object.values(results).filter(r => !r.success).length
    });

    return results;
  }

  // Test 2: Search Performance Under Load
  async testSearchPerformanceStress() {
    console.log('\n🔍 STRESS TEST: Search Performance Under Load');
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(STRESS_CONFIG.url, { waitUntil: 'networkidle0' });

    const searchTerms = [
      'Software Engineer',
      'Google',
      'Applied',
      'San Francisco',
      'React',
      'xyz-nonexistent-term',
      '2024',
      'Remote',
      'a', // Single character - stress test
      'very very very long search term that might cause issues'
    ];

    const results = {
      rapidSearches: [],
      concurrentSearches: [],
      memoryLeakTest: null,
      extremeTermTests: []
    };

    console.log('  📈 Testing rapid consecutive searches...');
    
    // Rapid consecutive searches
    for (let i = 0; i < STRESS_CONFIG.searchStressCount; i++) {
      const searchTerm = searchTerms[i % searchTerms.length];
      
      const startTime = performance.now();
      
      await page.evaluate((term) => {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
          searchInput.value = term;
          searchInput.dispatchEvent(new Event('input'));
        }
      }, searchTerm);

      // Don't wait for debouncing in stress test
      await page.waitForTimeout(10);
      
      const responseTime = performance.now() - startTime;
      
      results.rapidSearches.push({
        iteration: i + 1,
        searchTerm,
        responseTime,
        acceptable: responseTime < 500 // More lenient for stress test
      });

      if ((i + 1) % 100 === 0) {
        console.log(`    Completed ${i + 1}/${STRESS_CONFIG.searchStressCount} rapid searches`);
      }
    }

    const avgRapidSearchTime = results.rapidSearches.reduce((sum, r) => sum + r.responseTime, 0) / results.rapidSearches.length;
    const rapidSearchSuccess = avgRapidSearchTime < 300;

    console.log(`    ⏱️  Average rapid search time: ${avgRapidSearchTime.toFixed(2)}ms`);
    console.log(`    ${rapidSearchSuccess ? '✅' : '❌'} Rapid search stress test ${rapidSearchSuccess ? 'PASSED' : 'FAILED'}`);

    // Memory leak test during extended search usage
    console.log('  🧠 Testing for memory leaks during extended search usage...');
    
    const memoryTest = await page.evaluate(async () => {
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      let maxMemory = initialMemory;
      let currentMemory = initialMemory;
      
      const searchTerms = ['Software', 'Engineer', 'Google', 'Applied', 'Remote'];
      
      for (let i = 0; i < 1000; i++) {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) {
          const term = searchTerms[i % searchTerms.length] + i.toString();
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
          await new Promise(resolve => setTimeout(resolve, 5));
          searchInput.value = term;
          searchInput.dispatchEvent(new Event('input'));
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        if (i % 100 === 0 && performance.memory) {
          currentMemory = performance.memory.usedJSHeapSize;
          maxMemory = Math.max(maxMemory, currentMemory);
        }
      }
      
      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      return {
        initialMemoryMB: Math.round(initialMemory / 1024 / 1024),
        finalMemoryMB: Math.round(finalMemory / 1024 / 1024),
        maxMemoryMB: Math.round(maxMemory / 1024 / 1024),
        memoryIncreaseMB: Math.round((finalMemory - initialMemory) / 1024 / 1024)
      };
    });

    results.memoryLeakTest = {
      ...memoryTest,
      passed: memoryTest.memoryIncreaseMB < 50 // Less than 50MB increase
    };

    console.log(`    💾 Memory increase: ${memoryTest.memoryIncreaseMB}MB`);
    console.log(`    ${results.memoryLeakTest.passed ? '✅' : '❌'} Memory leak test ${results.memoryLeakTest.passed ? 'PASSED' : 'FAILED'}`);

    await page.close();

    this.results.testResults.push({
      testName: 'Search Performance Stress',
      results,
      passed: rapidSearchSuccess && results.memoryLeakTest.passed ? 1 : 0,
      failed: rapidSearchSuccess && results.memoryLeakTest.passed ? 0 : 1
    });

    return results;
  }

  // Test 3: Concurrent User Simulation
  async testConcurrentUsers() {
    console.log('\n👥 STRESS TEST: Concurrent User Simulation');
    
    const results = {};

    for (const userCount of STRESS_CONFIG.concurrentUsers) {
      console.log(`  👤 Testing ${userCount} concurrent users...`);
      
      const userResults = [];
      const pages = [];

      // Create pages for concurrent users
      for (let i = 0; i < userCount; i++) {
        const page = await this.browser.newPage();
        await page.setViewport({ width: 1200 + i * 10, height: 800 + i * 5 }); // Slight variation
        pages.push(page);
      }

      const startTime = performance.now();

      try {
        // Simulate concurrent user actions
        const userPromises = pages.map(async (page, userIndex) => {
          const userStart = performance.now();
          
          try {
            // Navigate
            await page.goto(STRESS_CONFIG.url, { 
              waitUntil: 'networkidle0',
              timeout: 30000
            });

            // Simulate user behavior
            await page.waitForSelector('table', { timeout: 10000 });
            
            // Random user actions
            const actions = ['search', 'scroll', 'click', 'filter'];
            
            for (let action = 0; action < 20; action++) {
              const randomAction = actions[Math.floor(Math.random() * actions.length)];
              
              switch (randomAction) {
                case 'search':
                  await page.type('input[placeholder*="Search"]', `test${userIndex}${action}`);
                  await page.waitForTimeout(100);
                  break;
                  
                case 'scroll':
                  await page.evaluate(() => window.scrollBy(0, 500));
                  await page.waitForTimeout(50);
                  break;
                  
                case 'click':
                  const buttons = await page.$$('button');
                  if (buttons.length > 0) {
                    await buttons[0].click();
                  }
                  break;
                  
                case 'filter':
                  const selects = await page.$$('select');
                  if (selects.length > 0) {
                    await page.select('select', 'Applied');
                  }
                  break;
              }
              
              await page.waitForTimeout(Math.random() * 100 + 50);
            }

            const userTime = performance.now() - userStart;
            
            return {
              userIndex,
              success: true,
              responseTime: userTime,
              error: null
            };

          } catch (error) {
            return {
              userIndex,
              success: false,
              responseTime: performance.now() - userStart,
              error: error.message
            };
          }
        });

        userResults.push(...await Promise.all(userPromises));

      } finally {
        // Close all pages
        await Promise.all(pages.map(page => page.close()));
      }

      const totalTime = performance.now() - startTime;
      const successfulUsers = userResults.filter(r => r.success).length;
      const avgResponseTime = userResults.reduce((sum, r) => sum + r.responseTime, 0) / userResults.length;

      results[userCount] = {
        totalUsers: userCount,
        successfulUsers,
        failedUsers: userCount - successfulUsers,
        successRate: (successfulUsers / userCount) * 100,
        totalTestTime: totalTime,
        avgUserResponseTime: avgResponseTime,
        passed: successRate > 90 && avgResponseTime < 10000
      };

      console.log(`    ✅ Successful users: ${successfulUsers}/${userCount} (${results[userCount].successRate.toFixed(1)}%)`);
      console.log(`    ⏱️  Average response time: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`    ${results[userCount].passed ? '✅' : '❌'} Concurrent users test ${results[userCount].passed ? 'PASSED' : 'FAILED'}`);
    }

    this.results.testResults.push({
      testName: 'Concurrent Users',
      results,
      passed: Object.values(results).filter(r => r.passed).length,
      failed: Object.values(results).filter(r => !r.passed).length
    });

    return results;
  }

  // Test 4: Edge Case Data Testing
  async testEdgeCases() {
    console.log('\n🔬 STRESS TEST: Edge Cases and Data Boundaries');
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const results = {
      emptyData: null,
      malformedData: null,
      specialCharacters: null,
      extremeValues: null,
      networkFailures: null
    };

    await page.goto(STRESS_CONFIG.url, { waitUntil: 'networkidle0' });

    // Test 1: Empty data handling
    console.log('  📋 Testing empty data handling...');
    results.emptyData = await page.evaluate(() => {
      try {
        // Simulate empty state
        if (window.setJobs) {
          window.setJobs([]);
        }
        
        const hasEmptyState = document.querySelector('[data-testid="empty-state"]') || 
                             document.body.textContent.includes('No applications') ||
                             document.querySelector('tbody tr').length === 0;
        
        return {
          success: true,
          hasEmptyState,
          error: null
        };
      } catch (error) {
        return {
          success: false,
          hasEmptyState: false,
          error: error.message
        };
      }
    });

    // Test 2: Special characters and unicode
    console.log('  🔣 Testing special characters and unicode...');
    results.specialCharacters = await page.evaluate(() => {
      const specialTestData = [
        {
          id: 1,
          company: 'Test & Co. "Special" <script>alert("xss")</script>',
          position: 'Software Engineer / Full Stack Developer @ Company',
          location: 'São Paulo, Brazil 🇧🇷 ñ ü ä',
          status: 'Applied',
          appliedDate: '2024-01-01',
          rejectionDate: null,
          jobSite: 'LinkedIn & Indeed',
          url: 'https://example.com/job?param=value&other=123',
          created_at: new Date().toISOString()
        }
      ];

      try {
        if (window.setJobs) {
          window.setJobs(specialTestData);
        }
        
        // Check if data renders without breaking
        const tableRows = document.querySelectorAll('tbody tr');
        const hasSpecialChars = document.body.textContent.includes('São Paulo');
        
        return {
          success: true,
          rowsRendered: tableRows.length,
          specialCharsRendered: hasSpecialChars,
          error: null
        };
      } catch (error) {
        return {
          success: false,
          rowsRendered: 0,
          specialCharsRendered: false,
          error: error.message
        };
      }
    });

    // Test 3: Extreme values
    console.log('  ⚡ Testing extreme values...');
    results.extremeValues = await page.evaluate(() => {
      const extremeTestData = [{
        id: 1,
        company: 'A'.repeat(1000), // Very long string
        position: 'B'.repeat(500),
        location: 'C'.repeat(200),
        status: 'Applied',
        appliedDate: '1900-01-01', // Very old date
        rejectionDate: '2099-12-31', // Future date
        jobSite: 'D'.repeat(100),
        url: 'https://example.com/' + 'E'.repeat(2000), // Very long URL
        created_at: new Date().toISOString()
      }];

      try {
        if (window.setJobs) {
          window.setJobs(extremeTestData);
        }
        
        const tableRows = document.querySelectorAll('tbody tr');
        
        return {
          success: true,
          rowsRendered: tableRows.length,
          error: null
        };
      } catch (error) {
        return {
          success: false,
          rowsRendered: 0,
          error: error.message
        };
      }
    });

    await page.close();

    const edgeCasePassed = [
      results.emptyData?.success,
      results.specialCharacters?.success,
      results.extremeValues?.success
    ].filter(Boolean).length;

    this.results.testResults.push({
      testName: 'Edge Cases',
      results,
      passed: edgeCasePassed,
      failed: 3 - edgeCasePassed
    });

    console.log(`  ✅ Edge case tests passed: ${edgeCasePassed}/3`);

    return results;
  }

  // Test 5: Memory Stress Test
  async testMemoryStress() {
    console.log('\n🧠 STRESS TEST: Extended Memory Usage');
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(STRESS_CONFIG.url, { waitUntil: 'networkidle0' });

    const memoryStressResult = await page.evaluate(async () => {
      const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      let maxMemoryUsed = startMemory;
      const memorySnapshots = [];
      
      console.log('Starting memory stress test...');
      
      // Create and destroy large amounts of data repeatedly
      for (let cycle = 0; cycle < 50; cycle++) {
        // Create large dataset
        const largeData = Array(5000).fill().map((_, i) => ({
          id: cycle * 5000 + i,
          company: `Company ${i} Cycle ${cycle}`,
          position: `Position ${i}`,
          location: `Location ${i}`,
          status: 'Applied',
          appliedDate: '2024-01-01',
          rejectionDate: null,
          jobSite: 'TestSite',
          url: `https://example.com/job/${i}`,
          created_at: new Date().toISOString(),
          // Add some extra data to increase memory usage
          extraData: Array(100).fill(`Extra data ${i}`)
        }));

        // Simulate updating application state
        if (window.setJobs) {
          window.setJobs(largeData);
        }
        
        // Force some DOM updates
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            // Simulate search operations
            const searchInput = document.querySelector('input[placeholder*="Search"]');
            if (searchInput) {
              searchInput.value = `search${cycle}`;
              searchInput.dispatchEvent(new Event('input'));
            }
            
            // Simulate scrolling
            window.scrollTo(0, cycle * 100);
            
            setTimeout(resolve, 50);
          });
        });

        // Take memory snapshot
        if (performance.memory) {
          const currentMemory = performance.memory.usedJSHeapSize;
          maxMemoryUsed = Math.max(maxMemoryUsed, currentMemory);
          
          if (cycle % 10 === 0) {
            memorySnapshots.push({
              cycle,
              memoryMB: Math.round(currentMemory / 1024 / 1024),
              timestamp: Date.now()
            });
          }
        }

        // Clear data periodically to test garbage collection
        if (cycle % 10 === 0) {
          largeData.length = 0; // Clear array
          if (window.gc) {
            window.gc(); // Force garbage collection if available
          }
        }
      }

      const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      return {
        startMemoryMB: Math.round(startMemory / 1024 / 1024),
        endMemoryMB: Math.round(endMemory / 1024 / 1024),
        maxMemoryMB: Math.round(maxMemoryUsed / 1024 / 1024),
        memoryIncreaseMB: Math.round((endMemory - startMemory) / 1024 / 1024),
        memorySnapshots,
        cycles: 50
      };
    });

    await page.close();

    const memoryEfficient = memoryStressResult.memoryIncreaseMB < 100; // Less than 100MB permanent increase
    const maxMemoryAcceptable = memoryStressResult.maxMemoryMB < 500; // Peak under 500MB

    console.log(`  📊 Start memory: ${memoryStressResult.startMemoryMB}MB`);
    console.log(`  📈 Peak memory: ${memoryStressResult.maxMemoryMB}MB`);
    console.log(`  📉 End memory: ${memoryStressResult.endMemoryMB}MB`);
    console.log(`  💾 Permanent increase: ${memoryStressResult.memoryIncreaseMB}MB`);
    console.log(`  ${memoryEfficient && maxMemoryAcceptable ? '✅' : '❌'} Memory stress test ${memoryEfficient && maxMemoryAcceptable ? 'PASSED' : 'FAILED'}`);

    this.results.testResults.push({
      testName: 'Memory Stress',
      results: memoryStressResult,
      passed: memoryEfficient && maxMemoryAcceptable ? 1 : 0,
      failed: memoryEfficient && maxMemoryAcceptable ? 0 : 1
    });

    return memoryStressResult;
  }

  generateSummary() {
    const totalTests = this.results.testResults.reduce((sum, test) => sum + test.passed + test.failed, 0);
    const totalPassed = this.results.testResults.reduce((sum, test) => sum + test.passed, 0);
    const totalFailed = this.results.testResults.reduce((sum, test) => sum + test.failed, 0);

    this.results.summary = {
      totalTests,
      totalPassed,
      totalFailed,
      passRate: totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0,
      criticalIssues: this.identifyCriticalIssues(),
      recommendations: this.generateRecommendations()
    };

    console.log('\n🏁 STRESS TEST RESULTS SUMMARY');
    console.log('=====================================');
    console.log(`📊 Total tests: ${totalTests}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📈 Pass rate: ${this.results.summary.passRate}%`);
    console.log('');

    this.results.testResults.forEach(test => {
      const testPassed = test.passed > test.failed;
      console.log(`${testPassed ? '✅' : '❌'} ${test.testName}: ${test.passed}/${test.passed + test.failed} subtests passed`);
    });

    if (this.results.summary.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND:');
      this.results.summary.criticalIssues.forEach(issue => {
        console.log(`• ${issue}`);
      });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    this.results.summary.recommendations.forEach(rec => {
      console.log(`• ${rec}`);
    });
  }

  identifyCriticalIssues() {
    const issues = [];

    this.results.testResults.forEach(test => {
      if (test.testName === 'Massive Dataset Loading' && test.failed > test.passed) {
        issues.push('Application fails to handle large datasets efficiently');
      }
      
      if (test.testName === 'Concurrent Users' && test.failed > 0) {
        issues.push('Application cannot handle concurrent user load');
      }
      
      if (test.testName === 'Memory Stress' && test.failed > 0) {
        issues.push('Memory leaks detected during extended usage');
      }
      
      if (test.testName === 'Search Performance Stress' && test.failed > 0) {
        issues.push('Search performance degrades under stress');
      }
    });

    return issues;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze results and generate specific recommendations
    const datasetTest = this.results.testResults.find(t => t.testName === 'Massive Dataset Loading');
    if (datasetTest && datasetTest.failed > 0) {
      recommendations.push('Implement virtual scrolling for large datasets');
      recommendations.push('Add data pagination to limit initial load size');
      recommendations.push('Use React.memo() and useMemo() for performance optimization');
    }

    const searchTest = this.results.testResults.find(t => t.testName === 'Search Performance Stress');
    if (searchTest && searchTest.failed > 0) {
      recommendations.push('Implement search indexing or use a search library like Fuse.js');
      recommendations.push('Increase debounce delay for search inputs under heavy load');
      recommendations.push('Add search result caching');
    }

    const memoryTest = this.results.testResults.find(t => t.testName === 'Memory Stress');
    if (memoryTest && memoryTest.failed > 0) {
      recommendations.push('Implement proper cleanup in useEffect hooks');
      recommendations.push('Use WeakMap/WeakSet for temporary object references');
      recommendations.push('Consider implementing data compression for large datasets');
    }

    const concurrentTest = this.results.testResults.find(t => t.testName === 'Concurrent Users');
    if (concurrentTest && concurrentTest.failed > 0) {
      recommendations.push('Implement request throttling and queue management');
      recommendations.push('Add loading states and proper error boundaries');
      recommendations.push('Consider using a state management library like Redux for complex state');
    }

    if (recommendations.length === 0) {
      recommendations.push('Excellent stress test performance! Consider increasing test severity');
      recommendations.push('Monitor performance in production with real user data');
      recommendations.push('Set up automated stress testing in CI/CD pipeline');
    }

    return recommendations;
  }

  async saveResults() {
    const filename = `stress-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(process.cwd(), 'test-results', filename);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    
    console.log(`\n💾 Stress test results saved to: ${filepath}`);
    return filepath;
  }

  async run() {
    try {
      await this.setup();
      
      console.log('🎯 Starting comprehensive stress testing...');
      console.log(`🌐 Target URL: ${STRESS_CONFIG.url}`);
      console.log('');

      // Run all stress tests
      await this.testMassiveDatasetLoad();
      await this.testSearchPerformanceStress();
      await this.testConcurrentUsers();
      await this.testEdgeCases();
      await this.testMemoryStress();

      // Generate summary
      this.generateSummary();
      
      // Save results
      await this.saveResults();

    } catch (error) {
      console.error('💥 Stress testing failed:', error.message);
      throw error;
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
🧪 Job Tracker Stress Testing Suite

Usage: node scripts/stress-tests.js [options]

Options:
  --url <url>         Application URL (default: http://localhost:5173)
  --users <n>         Max concurrent users to test (default: 50)
  --duration <ms>     Test duration in milliseconds (default: 60000)
  --help, -h          Show this help message

Example:
  node scripts/stress-tests.js --url http://localhost:3000 --users 25 --duration 30000
    `);
    return;
  }
  
  // Parse command line arguments
  const urlIndex = args.indexOf('--url');
  if (urlIndex !== -1 && urlIndex + 1 < args.length) {
    STRESS_CONFIG.url = args[urlIndex + 1];
  }
  
  const usersIndex = args.indexOf('--users');
  if (usersIndex !== -1 && usersIndex + 1 < args.length) {
    const maxUsers = parseInt(args[usersIndex + 1]);
    if (maxUsers > 0) {
      STRESS_CONFIG.concurrentUsers = STRESS_CONFIG.concurrentUsers.filter(u => u <= maxUsers);
    }
  }
  
  const durationIndex = args.indexOf('--duration');
  if (durationIndex !== -1 && durationIndex + 1 < args.length) {
    STRESS_CONFIG.testDuration = parseInt(args[durationIndex + 1]) || STRESS_CONFIG.testDuration;
  }
  
  const stressTester = new StressTester();
  await stressTester.run();
}

export { StressTester, STRESS_CONFIG };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Stress testing suite failed:', error);
    process.exit(1);
  });
}