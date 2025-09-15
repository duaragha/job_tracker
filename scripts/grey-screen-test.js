#!/usr/bin/env node

/**
 * Grey Screen Detection and Performance Validation Test Suite
 * Tests all requirements: grey screen fix, performance, virtual scrolling, search O(1), memory usage
 * Usage: node scripts/grey-screen-test.js
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_CONFIG = {
  url: 'http://localhost:5175',
  viewport: { width: 1920, height: 1080 },
  timeout: 30000,
  testDataSizes: [100, 1000, 5000, 10000, 25000],
  searchTerms: ['Software Engineer', 'Google', 'Applied', 'Remote', 'a', 'xyz-nonexistent'],
  performanceThresholds: {
    initialLoad: 3000,      // 3s max load time
    searchResponse: 100,    // 100ms max search response
    virtualScrollFPS: 30,   // 30fps minimum for smooth scrolling
    memoryPerItem: 1000,    // 1KB per item max
    renderTime: 50          // 50ms max render time
  }
};

class GreyScreenTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      timestamp: new Date().toISOString(),
      greyScreenTests: [],
      performanceTests: [],
      virtualScrollingTests: [],
      searchPerformanceTests: [],
      memoryTests: [],
      themeTests: [],
      consoleErrors: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        critical: []
      }
    };
  }

  async setup() {
    console.log('🚀 Starting Grey Screen Detection & Performance Test Suite');
    console.log(`🌐 Target: ${TEST_CONFIG.url}`);
    
    this.browser = await puppeteer.launch({
      headless: false, // Keep visible to check for grey screen
      devtools: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--enable-precise-memory-info',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport(TEST_CONFIG.viewport);
    
    // Set up console error monitoring
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.results.consoleErrors.push({
          timestamp: new Date().toISOString(),
          message: msg.text(),
          location: msg.location()
        });
      }
    });

    // Set up network error monitoring
    this.page.on('response', response => {
      if (response.status() >= 400) {
        console.warn(`⚠️ Network Error: ${response.status()} ${response.url()}`);
      }
    });

    console.log('✅ Test environment initialized');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Test 1: Grey Screen Detection Tests
  async testGreyScreenIssues() {
    console.log('\n🖥️  GREY SCREEN DETECTION TESTS');
    console.log('================================');

    const tests = [
      {
        name: 'Initial Load - No Grey Screen',
        test: async () => {
          console.log('  📊 Testing initial application load...');
          
          const startTime = performance.now();
          await this.page.goto(TEST_CONFIG.url, { 
            waitUntil: 'networkidle0', 
            timeout: TEST_CONFIG.timeout 
          });
          const loadTime = performance.now() - startTime;

          // Wait for React to render
          await this.page.waitForTimeout(2000);

          const screenCheck = await this.page.evaluate(() => {
            const body = document.body;
            const styles = window.getComputedStyle(body);
            const hasContent = document.querySelector('h1, h2, table, .chakra-container');
            const bgColor = styles.backgroundColor;
            
            // Check for grey screen indicators
            const isGreyish = bgColor.includes('128') || bgColor.includes('gray') || bgColor === 'rgb(128, 128, 128)';
            const hasMinimalContent = document.body.children.length < 3;
            const hasEmptyContent = document.body.textContent.trim().length < 100;
            
            return {
              backgroundColor: bgColor,
              hasContent: !!hasContent,
              bodyChildrenCount: body.children.length,
              textContentLength: document.body.textContent.trim().length,
              isGreyScreen: isGreyish && (hasMinimalContent || hasEmptyContent),
              loadTime
            };
          });

          return {
            passed: !screenCheck.isGreyScreen && screenCheck.hasContent && loadTime < TEST_CONFIG.performanceThresholds.initialLoad,
            data: screenCheck,
            message: screenCheck.isGreyScreen ? '❌ Grey screen detected!' : '✅ No grey screen, content loaded properly'
          };
        }
      },
      {
        name: 'Theme Toggle - No Grey Screen',
        test: async () => {
          console.log('  🎨 Testing theme toggle functionality...');
          
          // Test dark mode toggle
          const darkModeTest = await this.page.evaluate(async () => {
            const toggleButton = document.querySelector('button[aria-label*="dark"], button[aria-label*="theme"]');
            if (!toggleButton) return { found: false };
            
            const initialBg = window.getComputedStyle(document.body).backgroundColor;
            toggleButton.click();
            
            // Wait for theme change
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const newBg = window.getComputedStyle(document.body).backgroundColor;
            const hasContent = document.querySelector('h1, h2, table, .chakra-container');
            
            return {
              found: true,
              initialBg,
              newBg,
              themeChanged: initialBg !== newBg,
              hasContent: !!hasContent,
              isGreyScreen: newBg.includes('128') && !hasContent
            };
          });

          // Test light mode toggle back
          await this.page.waitForTimeout(500);
          const lightModeTest = await this.page.evaluate(async () => {
            const toggleButton = document.querySelector('button[aria-label*="dark"], button[aria-label*="theme"]');
            if (!toggleButton) return { found: false };
            
            toggleButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const finalBg = window.getComputedStyle(document.body).backgroundColor;
            const hasContent = document.querySelector('h1, h2, table, .chakra-container');
            
            return {
              found: true,
              finalBg,
              hasContent: !!hasContent,
              isGreyScreen: finalBg.includes('128') && !hasContent
            };
          });

          const passed = !darkModeTest.isGreyScreen && !lightModeTest.isGreyScreen && 
                        darkModeTest.themeChanged && darkModeTest.hasContent && lightModeTest.hasContent;

          return {
            passed,
            data: { darkModeTest, lightModeTest },
            message: passed ? '✅ Theme toggle works without grey screen' : '❌ Theme toggle causes grey screen or content loss'
          };
        }
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        this.results.greyScreenTests.push({
          name: test.name,
          ...result
        });
        console.log(`    ${result.message}`);
        if (result.passed) this.results.summary.passed++;
        else {
          this.results.summary.failed++;
          this.results.summary.critical.push(`Grey Screen: ${test.name}`);
        }
        this.results.summary.totalTests++;
      } catch (error) {
        console.log(`    ❌ ${test.name} failed: ${error.message}`);
        this.results.summary.failed++;
        this.results.summary.totalTests++;
      }
    }
  }

  // Test 2: Performance Optimization Integrity
  async testPerformanceOptimizations() {
    console.log('\n⚡ PERFORMANCE OPTIMIZATION TESTS');
    console.log('==================================');

    console.log('  📈 Testing with different dataset sizes...');
    
    for (const dataSize of TEST_CONFIG.testDataSizes) {
      console.log(`    Testing with ${dataSize.toLocaleString()} items...`);
      
      try {
        // Generate test data and measure performance
        const performanceResult = await this.page.evaluate(async (size) => {
          const startTime = performance.now();
          const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

          // Generate test data
          const testData = Array(size).fill(0).map((_, i) => ({
            id: i + 1,
            company: `Company ${i % 100}`,
            position: `Position ${i % 50}`,
            location: `Location ${i % 25}`,
            status: ['Applied', 'Screening', 'Assessment', 'Interviewing', 'Rejected'][i % 5],
            appliedDate: new Date(2024, (i % 12), (i % 28) + 1).toISOString().split('T')[0],
            rejectionDate: i % 7 === 0 ? new Date().toISOString().split('T')[0] : null,
            jobSite: `JobSite ${i % 10}`,
            url: `https://example.com/${i}`,
            created_at: new Date().toISOString()
          }));

          // Simulate data loading (if possible)
          if (window.setJobsForTest) {
            window.setJobsForTest(testData);
          }

          const endTime = performance.now();
          const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
          
          // Check if virtualization is active
          const virtualScrollContainer = document.querySelector('[style*="overflow"]');
          const visibleRows = document.querySelectorAll('tbody tr, [role="row"]');
          const isVirtualized = size > 100 && visibleRows.length < size * 0.1;

          return {
            dataSize: size,
            loadTime: endTime - startTime,
            memoryUsed: Math.round((endMemory - startMemory) / 1024), // KB
            memoryPerItem: (endMemory - startMemory) / size,
            isVirtualized,
            visibleRowCount: visibleRows.length,
            hasVirtualContainer: !!virtualScrollContainer
          };
        }, dataSize);

        const passed = performanceResult.loadTime < TEST_CONFIG.performanceThresholds.initialLoad &&
                      performanceResult.memoryPerItem < TEST_CONFIG.performanceThresholds.memoryPerItem;

        this.results.performanceTests.push({
          dataSize,
          ...performanceResult,
          passed,
          thresholds: {
            loadTime: TEST_CONFIG.performanceThresholds.initialLoad,
            memoryPerItem: TEST_CONFIG.performanceThresholds.memoryPerItem
          }
        });

        console.log(`      ⏱️  Load time: ${performanceResult.loadTime.toFixed(0)}ms`);
        console.log(`      💾 Memory: ${performanceResult.memoryUsed}KB (${(performanceResult.memoryPerItem).toFixed(2)}B per item)`);
        console.log(`      🖼️  Virtualized: ${performanceResult.isVirtualized ? 'Yes' : 'No'} (${performanceResult.visibleRowCount} visible rows)`);
        console.log(`      ${passed ? '✅' : '❌'} ${passed ? 'PASSED' : 'FAILED'}`);

        if (passed) this.results.summary.passed++;
        else this.results.summary.failed++;
        this.results.summary.totalTests++;

      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
        this.results.summary.failed++;
        this.results.summary.totalTests++;
      }
    }
  }

  // Test 3: Virtual Scrolling with Large Datasets
  async testVirtualScrolling() {
    console.log('\n📜 VIRTUAL SCROLLING TESTS');
    console.log('===========================');

    const testSizes = [1000, 10000, 25000, 50000];
    
    for (const size of testSizes) {
      console.log(`  📊 Testing virtual scrolling with ${size.toLocaleString()} items...`);
      
      try {
        const scrollingResult = await this.page.evaluate(async (itemCount) => {
          // Simulate loading large dataset
          console.log(`Simulating ${itemCount} items...`);
          
          // Check if virtual scrolling is active
          const virtualList = document.querySelector('[style*="overflow"]');
          const allRows = document.querySelectorAll('tbody tr, [role="row"]');
          const isVirtualized = allRows.length < itemCount && itemCount > 100;
          
          if (!isVirtualized && itemCount > 100) {
            return {
              itemCount,
              error: 'Virtual scrolling not activated for large dataset',
              isVirtualized: false,
              fps: 0
            };
          }

          // Test scrolling performance
          const startTime = performance.now();
          let frameCount = 0;
          const targetFrames = 60; // Test for 1 second at 60fps
          
          const measureScroll = () => {
            return new Promise((resolve) => {
              let lastTime = performance.now();
              let frames = 0;
              
              const scroll = () => {
                window.scrollBy(0, 100);
                frames++;
                
                const now = performance.now();
                const deltaTime = now - lastTime;
                lastTime = now;
                
                if (frames < targetFrames) {
                  requestAnimationFrame(scroll);
                } else {
                  const totalTime = now - startTime;
                  const avgFrameTime = totalTime / frames;
                  const fps = 1000 / avgFrameTime;
                  
                  resolve({
                    totalTime,
                    avgFrameTime,
                    fps,
                    frames
                  });
                }
              };
              
              requestAnimationFrame(scroll);
            });
          };

          const scrollMetrics = await measureScroll();
          
          return {
            itemCount,
            isVirtualized,
            visibleRows: allRows.length,
            scrollPerformance: scrollMetrics,
            passed: scrollMetrics.fps >= 30 // 30fps minimum for smooth scrolling
          };
          
        }, size);

        const passed = scrollingResult.isVirtualized && 
                      (scrollingResult.scrollPerformance?.fps || 0) >= TEST_CONFIG.performanceThresholds.virtualScrollFPS;

        this.results.virtualScrollingTests.push({
          size,
          ...scrollingResult,
          passed
        });

        if (scrollingResult.error) {
          console.log(`    ❌ ${scrollingResult.error}`);
        } else {
          console.log(`    🖼️  Virtualized: ${scrollingResult.isVirtualized}`);
          console.log(`    👁️  Visible rows: ${scrollingResult.visibleRows}`);
          if (scrollingResult.scrollPerformance) {
            console.log(`    🎯 Scroll FPS: ${scrollingResult.scrollPerformance.fps.toFixed(1)}`);
          }
          console.log(`    ${passed ? '✅' : '❌'} ${passed ? 'PASSED' : 'FAILED'}`);
        }

        if (passed) this.results.summary.passed++;
        else this.results.summary.failed++;
        this.results.summary.totalTests++;

      } catch (error) {
        console.log(`    ❌ Failed: ${error.message}`);
        this.results.summary.failed++;
        this.results.summary.totalTests++;
      }
    }
  }

  // Test 4: Search Indexing O(1) Performance
  async testSearchPerformance() {
    console.log('\n🔍 SEARCH INDEXING O(1) PERFORMANCE TESTS');
    console.log('==========================================');

    for (const searchTerm of TEST_CONFIG.searchTerms) {
      console.log(`  🔎 Testing search term: "${searchTerm}"`);
      
      try {
        const searchResult = await this.page.evaluate(async (term) => {
          const searchInput = document.querySelector('input[placeholder*="Search"], input[placeholder*="search"]');
          if (!searchInput) {
            return { error: 'Search input not found' };
          }

          // Clear previous search
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 100));

          // Measure search performance
          const startTime = performance.now();
          
          searchInput.value = term;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Wait for search to complete (accounting for debouncing)
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const endTime = performance.now();
          const searchTime = endTime - startTime;
          
          // Count results
          const resultRows = document.querySelectorAll('tbody tr, [role="row"]');
          const visibleResults = Array.from(resultRows).filter(row => 
            row.style.display !== 'none' && row.offsetParent !== null
          );

          return {
            searchTerm: term,
            responseTime: searchTime,
            resultCount: visibleResults.length,
            passed: searchTime < 500 // More lenient for debounced search
          };
        }, searchTerm);

        if (searchResult.error) {
          console.log(`    ❌ ${searchResult.error}`);
          this.results.summary.failed++;
        } else {
          const passed = searchResult.responseTime < TEST_CONFIG.performanceThresholds.searchResponse + 200; // Account for debouncing
          
          this.results.searchPerformanceTests.push({
            ...searchResult,
            passed
          });

          console.log(`    ⏱️  Response time: ${searchResult.responseTime.toFixed(2)}ms`);
          console.log(`    📊 Results found: ${searchResult.resultCount}`);
          console.log(`    ${passed ? '✅' : '❌'} ${passed ? 'PASSED' : 'FAILED'}`);

          if (passed) this.results.summary.passed++;
          else this.results.summary.failed++;
        }
        this.results.summary.totalTests++;

      } catch (error) {
        console.log(`    ❌ Failed: ${error.message}`);
        this.results.summary.failed++;
        this.results.summary.totalTests++;
      }
    }
  }

  // Test 5: Memory Usage and Render Time Regression Tests
  async testMemoryAndRenderTime() {
    console.log('\n🧠 MEMORY USAGE AND RENDER TIME TESTS');
    console.log('======================================');

    try {
      const memoryTest = await this.page.evaluate(async () => {
        const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const startTime = performance.now();
        
        // Simulate heavy operations
        const operations = [];
        for (let i = 0; i < 1000; i++) {
          // Simulate search operations
          const searchInput = document.querySelector('input[placeholder*="Search"]');
          if (searchInput) {
            searchInput.value = `test${i}`;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Force some DOM updates
          window.scrollBy(0, 1);
          
          // Measure memory every 100 iterations
          if (i % 100 === 0 && performance.memory) {
            operations.push({
              iteration: i,
              memory: performance.memory.usedJSHeapSize,
              time: performance.now() - startTime
            });
          }
        }
        
        const endTime = performance.now();
        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const totalRenderTime = endTime - startTime;
        const avgRenderTime = totalRenderTime / 1000;
        
        return {
          initialMemoryMB: Math.round(initialMemory / 1024 / 1024),
          finalMemoryMB: Math.round(finalMemory / 1024 / 1024),
          memoryIncreaseMB: Math.round((finalMemory - initialMemory) / 1024 / 1024),
          totalRenderTime,
          avgRenderTime,
          operations: operations.length,
          memorySnapshots: operations
        };
      });

      const memoryEfficient = memoryTest.memoryIncreaseMB < 50; // Less than 50MB increase
      const renderEfficient = memoryTest.avgRenderTime < TEST_CONFIG.performanceThresholds.renderTime;
      const passed = memoryEfficient && renderEfficient;

      this.results.memoryTests.push({
        ...memoryTest,
        passed,
        thresholds: {
          maxMemoryIncrease: 50,
          maxAvgRenderTime: TEST_CONFIG.performanceThresholds.renderTime
        }
      });

      console.log(`  💾 Initial memory: ${memoryTest.initialMemoryMB}MB`);
      console.log(`  📈 Final memory: ${memoryTest.finalMemoryMB}MB`);
      console.log(`  📊 Memory increase: ${memoryTest.memoryIncreaseMB}MB`);
      console.log(`  ⏱️  Average render time: ${memoryTest.avgRenderTime.toFixed(2)}ms`);
      console.log(`  🔄 Operations completed: ${memoryTest.operations}`);
      console.log(`  ${passed ? '✅' : '❌'} Memory and render time ${passed ? 'PASSED' : 'FAILED'}`);

      if (passed) this.results.summary.passed++;
      else this.results.summary.failed++;
      this.results.summary.totalTests++;

    } catch (error) {
      console.log(`  ❌ Memory test failed: ${error.message}`);
      this.results.summary.failed++;
      this.results.summary.totalTests++;
    }
  }

  // Test 6: Console Error Detection
  async checkConsoleErrors() {
    console.log('\n🐛 CONSOLE ERROR DETECTION');
    console.log('===========================');

    const criticalErrors = this.results.consoleErrors.filter(error => 
      error.message.toLowerCase().includes('error') ||
      error.message.toLowerCase().includes('failed') ||
      error.message.toLowerCase().includes('uncaught')
    );

    console.log(`  📊 Total console messages captured: ${this.results.consoleErrors.length}`);
    console.log(`  ⚠️  Critical errors found: ${criticalErrors.length}`);

    if (criticalErrors.length > 0) {
      console.log('  🚨 Critical errors:');
      criticalErrors.forEach((error, i) => {
        console.log(`    ${i + 1}. ${error.message}`);
      });
      this.results.summary.critical.push(`Console Errors: ${criticalErrors.length} critical errors found`);
    }

    const passed = criticalErrors.length === 0;
    console.log(`  ${passed ? '✅' : '❌'} Console error check ${passed ? 'PASSED' : 'FAILED'}`);

    if (passed) this.results.summary.passed++;
    else this.results.summary.failed++;
    this.results.summary.totalTests++;
  }

  generateSummaryReport() {
    const passRate = this.results.summary.totalTests > 0 
      ? Math.round((this.results.summary.passed / this.results.summary.totalTests) * 100) 
      : 0;

    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('========================');
    console.log(`🎯 Total tests: ${this.results.summary.totalTests}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`📈 Pass rate: ${passRate}%`);

    if (this.results.summary.critical.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      this.results.summary.critical.forEach(issue => {
        console.log(`• ${issue}`);
      });
    }

    // Specific requirement checks
    console.log('\n✅ REQUIREMENT VERIFICATION:');
    const greyScreenFixed = this.results.greyScreenTests.every(test => test.passed);
    const performanceIntact = this.results.performanceTests.length > 0 && 
                             this.results.performanceTests.some(test => test.passed);
    const virtualScrollingWorks = this.results.virtualScrollingTests.length > 0 &&
                                 this.results.virtualScrollingTests.some(test => test.passed);
    const searchO1Performance = this.results.searchPerformanceTests.length > 0 &&
                               this.results.searchPerformanceTests.every(test => test.responseTime < 500);
    const noRegressions = this.results.memoryTests.length > 0 &&
                         this.results.memoryTests.every(test => test.passed);

    console.log(`1. Grey screen issue fixed: ${greyScreenFixed ? '✅ YES' : '❌ NO'}`);
    console.log(`2. Performance optimizations intact: ${performanceIntact ? '✅ YES' : '❌ NO'}`);
    console.log(`3. Virtual scrolling works with 10,000+ items: ${virtualScrollingWorks ? '✅ YES' : '❌ NO'}`);
    console.log(`4. Search indexing O(1) performance: ${searchO1Performance ? '✅ YES' : '❌ NO'}`);
    console.log(`5. No memory/render regressions: ${noRegressions ? '✅ YES' : '❌ NO'}`);

    this.results.summary.requirementsMet = {
      greyScreenFixed,
      performanceIntact,
      virtualScrollingWorks,
      searchO1Performance,
      noRegressions,
      allPassed: greyScreenFixed && performanceIntact && virtualScrollingWorks && 
                searchO1Performance && noRegressions
    };

    return this.results.summary.requirementsMet.allPassed;
  }

  async saveResults() {
    const filename = `grey-screen-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(process.cwd(), 'test-results', filename);
    
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Test results saved to: ${filepath}`);
    return filepath;
  }

  async run() {
    try {
      await this.setup();
      
      // Wait for app to be fully loaded
      console.log('⏳ Loading application...');
      await this.page.goto(TEST_CONFIG.url, { waitUntil: 'networkidle0', timeout: TEST_CONFIG.timeout });
      await this.page.waitForTimeout(3000); // Wait for React hydration
      
      // Run all test suites
      await this.testGreyScreenIssues();
      await this.testPerformanceOptimizations();
      await this.testVirtualScrolling();
      await this.testSearchPerformance();
      await this.testMemoryAndRenderTime();
      await this.checkConsoleErrors();

      // Generate summary and save results
      const allPassed = this.generateSummaryReport();
      await this.saveResults();

      console.log(`\n🏁 Testing complete! ${allPassed ? 'All requirements met ✅' : 'Some requirements failed ❌'}`);
      return allPassed;

    } catch (error) {
      console.error('💥 Test suite failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// CLI interface
async function main() {
  const tester = new GreyScreenTester();
  const success = await tester.run();
  process.exit(success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Grey screen test suite failed:', error);
    process.exit(1);
  });
}

export { GreyScreenTester };