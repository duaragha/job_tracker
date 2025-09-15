#!/usr/bin/env node

/**
 * Manual Testing Checklist and Quick Validation Script
 * Tests critical requirements without browser automation
 * Usage: node scripts/manual-test-checklist.js
 */

import puppeteer from 'puppeteer';
import { performance } from 'perf_hooks';

const TEST_URL = 'http://localhost:5175';

async function quickHealthCheck() {
  console.log('🏥 QUICK HEALTH CHECK');
  console.log('====================');
  
  let browser;
  try {
    console.log('🚀 Starting browser...');
    browser = await puppeteer.launch({ 
      headless: false, // Keep visible to check for grey screen
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    const page = await browser.newPage();
    
    // Monitor console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    console.log('🌐 Loading application...');
    const startTime = performance.now();
    await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    const loadTime = performance.now() - startTime;
    
    console.log(`⏱️  Load time: ${loadTime.toFixed(0)}ms`);
    
    // Wait for React to hydrate
    await page.waitForTimeout(2000);
    
    // Take screenshot for manual inspection
    await page.screenshot({ path: 'test-results/app-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to test-results/app-screenshot.png');
    
    // Quick checks
    const checks = await page.evaluate(() => {
      const results = {};
      
      // Check for grey screen indicators
      const body = document.body;
      const styles = window.getComputedStyle(body);
      results.backgroundColor = styles.backgroundColor;
      results.bodyChildren = body.children.length;
      results.hasMainHeading = !!document.querySelector('h1, h2');
      results.hasTable = !!document.querySelector('table, [role="table"]');
      results.hasSearchInput = !!document.querySelector('input[placeholder*="Search"], input[placeholder*="search"]');
      results.hasThemeToggle = !!document.querySelector('button[aria-label*="dark"], button[aria-label*="theme"]');
      results.textContent = document.body.textContent.trim().length;
      
      // Check for loading/error states
      results.hasLoadingSpinner = !!document.querySelector('.spinner, [role="progressbar"]');
      results.hasErrorMessage = document.body.textContent.toLowerCase().includes('error');
      
      // Quick performance check
      results.memoryUsage = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0;
      
      return results;
    });
    
    console.log('\n📊 APPLICATION STATE ANALYSIS:');
    console.log(`  Background color: ${checks.backgroundColor}`);
    console.log(`  Body children: ${checks.bodyChildren}`);
    console.log(`  Has main heading: ${checks.hasMainHeading ? '✅' : '❌'}`);
    console.log(`  Has data table: ${checks.hasTable ? '✅' : '❌'}`);
    console.log(`  Has search input: ${checks.hasSearchInput ? '✅' : '❌'}`);
    console.log(`  Has theme toggle: ${checks.hasThemeToggle ? '✅' : '❌'}`);
    console.log(`  Content length: ${checks.textContent} characters`);
    console.log(`  Memory usage: ${checks.memoryUsage}MB`);
    console.log(`  Loading spinner: ${checks.hasLoadingSpinner ? '⚠️ Still loading' : '✅ Loaded'}`);
    console.log(`  Error messages: ${checks.hasErrorMessage ? '❌ Errors present' : '✅ No errors'}`);
    
    // Check for grey screen
    const isGreyScreen = checks.backgroundColor.includes('128') || 
                        checks.bodyChildren < 3 || 
                        checks.textContent < 100 ||
                        (!checks.hasMainHeading && !checks.hasTable);
    
    console.log(`\n🖥️  GREY SCREEN CHECK: ${isGreyScreen ? '❌ DETECTED' : '✅ NOT DETECTED'}`);
    
    // Console errors
    console.log(`\n🐛 CONSOLE ERRORS: ${errors.length} errors found`);
    if (errors.length > 0) {
      errors.slice(0, 5).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    // Quick theme toggle test
    console.log('\n🎨 Testing theme toggle...');
    try {
      await page.evaluate(() => {
        const toggle = document.querySelector('button[aria-label*="dark"], button[aria-label*="theme"]');
        if (toggle) toggle.click();
      });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/app-screenshot-dark.png' });
      console.log('🌙 Dark mode screenshot saved');
      
      // Switch back to light mode
      await page.evaluate(() => {
        const toggle = document.querySelector('button[aria-label*="dark"], button[aria-label*="theme"]');
        if (toggle) toggle.click();
      });
      await page.waitForTimeout(1000);
      console.log('☀️ Switched back to light mode');
    } catch (e) {
      console.log('⚠️ Theme toggle test failed:', e.message);
    }
    
    return {
      loadTime,
      greyScreenDetected: isGreyScreen,
      consoleErrors: errors.length,
      basicFunctionality: checks.hasMainHeading && checks.hasTable && checks.hasSearchInput,
      memoryUsage: checks.memoryUsage
    };
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return null;
  } finally {
    if (browser) {
      console.log('\n⏳ Keeping browser open for 10 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }
}

// Run manual testing checklist
async function runManualChecklist() {
  console.log('📋 MANUAL TESTING CHECKLIST');
  console.log('============================');
  
  console.log('\n✅ CRITICAL REQUIREMENTS TO VERIFY MANUALLY:');
  console.log('1. ❓ Grey screen issue is fixed');
  console.log('2. ❓ Performance optimizations remain intact');
  console.log('3. ❓ Virtual scrolling works with 10,000+ items');
  console.log('4. ❓ Search indexing performs at O(1) speed');
  console.log('5. ❓ No regressions in render time or memory usage');
  console.log('6. ❓ Light and dark modes work correctly');
  
  console.log('\n📖 MANUAL TESTING STEPS:');
  console.log('1. Open browser to http://localhost:5175');
  console.log('2. Verify no grey/blank screen on load');
  console.log('3. Check main heading and table are visible');
  console.log('4. Toggle between light and dark modes');
  console.log('5. Test search functionality with different terms');
  console.log('6. Scroll through data to check for smooth performance');
  console.log('7. Check browser console (F12) for errors');
  console.log('8. Monitor memory usage during heavy operations');
  
  console.log('\n🚀 Starting automated quick check...');
  
  const results = await quickHealthCheck();
  
  if (results) {
    console.log('\n📊 QUICK CHECK RESULTS:');
    console.log('========================');
    console.log(`Load Time: ${results.loadTime.toFixed(0)}ms ${results.loadTime < 3000 ? '✅' : '❌'}`);
    console.log(`Grey Screen: ${results.greyScreenDetected ? '❌ DETECTED' : '✅ NOT DETECTED'}`);
    console.log(`Console Errors: ${results.consoleErrors} ${results.consoleErrors === 0 ? '✅' : '⚠️'}`);
    console.log(`Basic Functionality: ${results.basicFunctionality ? '✅ WORKING' : '❌ ISSUES'}`);
    console.log(`Memory Usage: ${results.memoryUsage}MB ${results.memoryUsage < 200 ? '✅' : '⚠️'}`);
    
    const overallHealth = !results.greyScreenDetected && 
                         results.basicFunctionality && 
                         results.loadTime < 5000 &&
                         results.consoleErrors < 5;
    
    console.log(`\n🎯 OVERALL HEALTH: ${overallHealth ? '✅ GOOD' : '❌ NEEDS ATTENTION'}`);
    
    return overallHealth;
  }
  
  return false;
}

// Performance testing recommendations
function showPerformanceTestingSteps() {
  console.log('\n🏃 PERFORMANCE TESTING RECOMMENDATIONS:');
  console.log('=======================================');
  
  console.log('\n📊 To test with large datasets:');
  console.log('1. Open browser dev tools (F12) → Performance tab');
  console.log('2. Navigate to the app and start recording');
  console.log('3. Add multiple job entries or generate test data');
  console.log('4. Test search with various terms');
  console.log('5. Scroll through the list');
  console.log('6. Stop recording and analyze:');
  console.log('   - Frame rate during scrolling (should be 60fps)');
  console.log('   - Memory usage (watch for leaks)');
  console.log('   - JavaScript execution time');
  
  console.log('\n🔍 To test search performance:');
  console.log('1. Open browser console');
  console.log('2. Type: console.time("search"); [perform search]; console.timeEnd("search")');
  console.log('3. Search response should be < 100ms');
  
  console.log('\n🖼️ To test virtual scrolling:');
  console.log('1. Check if virtualization activates with 100+ items');
  console.log('2. Verify only visible rows are in DOM');
  console.log('3. Test smooth scrolling with large datasets');
  
  console.log('\n💾 To test memory usage:');
  console.log('1. Dev tools → Memory tab');
  console.log('2. Take heap snapshot before operations');
  console.log('3. Perform heavy operations (search, scroll, add items)');
  console.log('4. Take another heap snapshot');
  console.log('5. Compare memory usage (should not increase significantly)');
}

// Main execution
async function main() {
  console.log('🧪 JOB TRACKER TESTING SUITE');
  console.log('=============================\n');
  
  const healthy = await runManualChecklist();
  showPerformanceTestingSteps();
  
  console.log('\n📝 TEST REPORT SUMMARY:');
  console.log('=======================');
  console.log(`Application Health: ${healthy ? '✅ GOOD' : '❌ ISSUES DETECTED'}`);
  console.log('Screenshots saved in test-results/ directory');
  console.log('Manual verification still required for complete testing');
  
  process.exit(healthy ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Testing failed:', error);
    process.exit(1);
  });
}