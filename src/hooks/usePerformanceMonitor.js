import { useEffect, useRef, useState } from 'react';

export const usePerformanceMonitor = (componentName = 'Component') => {
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    memoryUsage: 0,
    fps: 60
  });
  
  const renderCount = useRef(0);
  const renderTimes = useRef([]);
  const lastFrameTime = useRef(performance.now());
  const frameCount = useRef(0);
  
  useEffect(() => {
    const startTime = performance.now();
    renderCount.current++;
    
    // Calculate render time
    const renderTime = performance.now() - startTime;
    renderTimes.current.push(renderTime);
    
    // Keep only last 100 render times
    if (renderTimes.current.length > 100) {
      renderTimes.current.shift();
    }
    
    // Calculate average render time
    const avgRenderTime = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
    
    // Estimate memory usage (if available)
    let memoryUsage = 0;
    if (performance.memory) {
      memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576); // Convert to MB
    }
    
    // Calculate FPS
    const currentFrameTime = performance.now();
    const deltaTime = currentFrameTime - lastFrameTime.current;
    frameCount.current++;
    
    if (deltaTime >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / deltaTime);
      frameCount.current = 0;
      lastFrameTime.current = currentFrameTime;
      
      setMetrics({
        renderCount: renderCount.current,
        averageRenderTime: avgRenderTime.toFixed(2),
        lastRenderTime: renderTime.toFixed(2),
        memoryUsage,
        fps
      });
    }
    
    // Log performance warnings
    if (renderTime > 16.67) { // 60fps threshold
      console.warn(`⚠️ ${componentName} render took ${renderTime.toFixed(2)}ms (target: <16.67ms for 60fps)`);
    }
    
    if (memoryUsage > 500) { // 500MB threshold
      console.warn(`⚠️ High memory usage: ${memoryUsage}MB`);
    }
  });
  
  // Track search performance
  const measureSearch = (searchFn) => {
    return (...args) => {
      const startTime = performance.now();
      const result = searchFn(...args);
      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      if (searchTime > 100) {
        console.warn(`⚠️ Slow search: ${searchTime.toFixed(2)}ms (target: <100ms)`);
      } else {
        console.log(`✅ Fast search: ${searchTime.toFixed(2)}ms`);
      }
      
      return result;
    };
  };
  
  // Track scroll performance
  const measureScroll = (scrollFn) => {
    let lastScrollTime = 0;
    let scrollFrameCount = 0;
    
    return (e) => {
      const currentTime = performance.now();
      if (lastScrollTime) {
        const deltaTime = currentTime - lastScrollTime;
        const scrollFPS = Math.round(1000 / deltaTime);
        
        if (scrollFPS < 30) {
          console.warn(`⚠️ Low scroll FPS: ${scrollFPS} (target: 60fps)`);
        }
        
        scrollFrameCount++;
        if (scrollFrameCount % 60 === 0) {
          console.log(`📊 Scroll performance: ${scrollFPS} FPS`);
        }
      }
      lastScrollTime = currentTime;
      
      if (scrollFn) scrollFn(e);
    };
  };
  
  // Performance report
  const getPerformanceReport = () => {
    const report = {
      component: componentName,
      metrics: {
        ...metrics,
        timestamp: new Date().toISOString()
      },
      recommendations: []
    };
    
    // Add recommendations based on metrics
    if (metrics.averageRenderTime > 16.67) {
      report.recommendations.push('Consider memoization to reduce render time');
    }
    
    if (metrics.renderCount > 100) {
      report.recommendations.push('High render count detected - check for unnecessary re-renders');
    }
    
    if (metrics.memoryUsage > 200) {
      report.recommendations.push('High memory usage - consider data virtualization or pagination');
    }
    
    if (metrics.fps < 30) {
      report.recommendations.push('Low FPS detected - optimize heavy computations');
    }
    
    return report;
  };
  
  // Log initial mount
  useEffect(() => {
    console.log(`🚀 ${componentName} mounted - Performance monitoring active`);
    
    // Set up performance observer for long tasks
    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn(`⚠️ Long task detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Long task observer not supported
      }
      
      return () => observer.disconnect();
    }
  }, [componentName]);
  
  return {
    metrics,
    measureSearch,
    measureScroll,
    getPerformanceReport
  };
};

// Global performance tracker
export const PerformanceTracker = {
  marks: new Map(),
  measures: new Map(),
  
  startMeasure(name) {
    this.marks.set(name, performance.now());
  },
  
  endMeasure(name) {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No start mark found for ${name}`);
      return null;
    }
    
    const duration = performance.now() - startTime;
    this.measures.set(name, duration);
    this.marks.delete(name);
    
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    return duration;
  },
  
  getReport() {
    const report = {};
    this.measures.forEach((value, key) => {
      report[key] = `${value.toFixed(2)}ms`;
    });
    return report;
  },
  
  clear() {
    this.marks.clear();
    this.measures.clear();
  }
};