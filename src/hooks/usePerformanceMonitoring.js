import { useEffect, useRef, useCallback } from 'react';

/**
 * Production Performance Monitoring Hook
 * Tracks key performance metrics in real-time for the Job Tracker application
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoadTime: 0,
      searchResponseTimes: [],
      memoryUsage: [],
      userInteractions: [],
      errorCount: 0,
      renderTimes: [],
      apiResponseTimes: []
    };
    
    this.observers = {
      performance: null,
      memory: null,
      intersection: null
    };

    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.startTime = performance.now();
    
    // Initialize performance monitoring
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    // Monitor page load performance
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.setupPerformanceObserver();
      this.setupMemoryMonitoring();
      this.setupUserInteractionTracking();
    }
  }

  setupPerformanceObserver() {
    try {
      // Monitor navigation timing
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.metrics.pageLoadTime = entry.loadEventEnd - entry.fetchStart;
            this.reportMetric('page_load_time', this.metrics.pageLoadTime);
          }
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      
      // Monitor paint timing
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.reportMetric(`paint_${entry.name}`, entry.startTime);
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });

      // Monitor largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.reportMetric('largest_contentful_paint', entry.startTime);
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Monitor first input delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.reportMetric('first_input_delay', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      this.observers.performance = { navObserver, paintObserver, lcpObserver, fidObserver };
    } catch (error) {
      console.warn('Performance monitoring setup failed:', error);
    }
  }

  setupMemoryMonitoring() {
    if (performance.memory) {
      const monitorMemory = () => {
        const memInfo = {
          usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
          totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
          jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024), // MB
          timestamp: Date.now()
        };
        
        this.metrics.memoryUsage.push(memInfo);
        
        // Keep only last 100 entries to prevent memory leak
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage.shift();
        }
        
        // Alert if memory usage is high
        if (memInfo.usedJSHeapSize > 100) { // Over 100MB
          this.reportAlert('high_memory_usage', memInfo);
        }
      };

      // Monitor memory every 30 seconds
      this.memoryInterval = setInterval(monitorMemory, 30000);
      monitorMemory(); // Initial measurement
    }
  }

  setupUserInteractionTracking() {
    const trackInteraction = (type, target, timestamp) => {
      const interaction = {
        type,
        target: target?.tagName || 'unknown',
        timestamp,
        sessionTime: timestamp - this.startTime
      };
      
      this.metrics.userInteractions.push(interaction);
      
      // Keep only last 1000 interactions
      if (this.metrics.userInteractions.length > 1000) {
        this.metrics.userInteractions.shift();
      }
    };

    // Track clicks
    document.addEventListener('click', (e) => {
      trackInteraction('click', e.target, performance.now());
    }, { passive: true });

    // Track key presses (for search responsiveness)
    document.addEventListener('keyup', (e) => {
      if (e.target.matches('input[placeholder*="Search"]')) {
        trackInteraction('search_keyup', e.target, performance.now());
      }
    }, { passive: true });

    // Track scroll events
    let scrollTimeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        trackInteraction('scroll', document.documentElement, performance.now());
      }, 100);
    }, { passive: true });
  }

  // Track search performance
  trackSearchPerformance(searchTerm, startTime, endTime, resultCount) {
    const responseTime = endTime - startTime;
    const searchMetric = {
      searchTerm,
      responseTime,
      resultCount,
      timestamp: Date.now()
    };
    
    this.metrics.searchResponseTimes.push(searchMetric);
    
    // Keep only last 100 searches
    if (this.metrics.searchResponseTimes.length > 100) {
      this.metrics.searchResponseTimes.shift();
    }
    
    this.reportMetric('search_response_time', responseTime);
    
    // Alert if search is slow
    if (responseTime > 500) {
      this.reportAlert('slow_search_response', searchMetric);
    }
  }

  // Track API performance
  trackApiCall(endpoint, method, startTime, endTime, status, error = null) {
    const responseTime = endTime - startTime;
    const apiMetric = {
      endpoint,
      method,
      responseTime,
      status,
      error,
      timestamp: Date.now()
    };
    
    this.metrics.apiResponseTimes.push(apiMetric);
    
    // Keep only last 100 API calls
    if (this.metrics.apiResponseTimes.length > 100) {
      this.metrics.apiResponseTimes.shift();
    }
    
    this.reportMetric('api_response_time', responseTime);
    
    // Track errors
    if (error || status >= 400) {
      this.metrics.errorCount++;
      this.reportAlert('api_error', apiMetric);
    }
    
    // Alert if API is slow
    if (responseTime > 2000) {
      this.reportAlert('slow_api_response', apiMetric);
    }
  }

  // Track render performance
  trackRenderPerformance(componentName, renderTime) {
    const renderMetric = {
      componentName,
      renderTime,
      timestamp: Date.now()
    };
    
    this.metrics.renderTimes.push(renderMetric);
    
    // Keep only last 100 renders
    if (this.metrics.renderTimes.length > 100) {
      this.metrics.renderTimes.shift();
    }
    
    this.reportMetric(`render_time_${componentName}`, renderTime);
    
    // Alert if render is slow
    if (renderTime > 100) {
      this.reportAlert('slow_render', renderMetric);
    }
  }

  // Report metric to monitoring service
  reportMetric(metricName, value, tags = {}) {
    const metric = {
      name: metricName,
      value,
      tags: {
        ...tags,
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      timestamp: Date.now()
    };

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(metric);
    } else {
      // In development, log to console
      console.debug('Performance Metric:', metric);
    }
  }

  // Report performance alert
  reportAlert(alertType, data) {
    const alert = {
      type: alertType,
      data,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      url: window.location.href
    };

    if (process.env.NODE_ENV === 'production') {
      this.sendAlertToMonitoringService(alert);
    } else {
      console.warn('Performance Alert:', alert);
    }
  }

  // Send metrics to monitoring service (implement based on your monitoring solution)
  async sendToMonitoringService(metric) {
    try {
      // Example implementation for sending to a monitoring service
      // Replace with your actual monitoring service (e.g., DataDog, New Relic, etc.)
      
      // Using fetch to send to custom endpoint
      /*
      await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metric)
      });
      */
      
      // Using console for now - replace with actual service
      if (Math.random() < 0.1) { // Sample 10% of metrics to avoid spam
        console.info('📊 Performance Metric:', {
          metric: metric.name,
          value: typeof metric.value === 'number' ? Math.round(metric.value) : metric.value,
          session: metric.tags.sessionId.slice(-8)
        });
      }
    } catch (error) {
      console.error('Failed to send metric to monitoring service:', error);
    }
  }

  async sendAlertToMonitoringService(alert) {
    try {
      // Send critical alerts to monitoring service
      console.warn('🚨 Performance Alert:', {
        type: alert.type,
        sessionId: alert.sessionId.slice(-8),
        timestamp: new Date(alert.timestamp).toISOString(),
        data: alert.data
      });
      
      // In production, implement actual alerting
      /*
      await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });
      */
    } catch (error) {
      console.error('Failed to send alert to monitoring service:', error);
    }
  }

  // Get current performance summary
  getPerformanceSummary() {
    const now = Date.now();
    const recentSearches = this.metrics.searchResponseTimes.filter(s => (now - s.timestamp) < 300000); // Last 5 minutes
    const recentApi = this.metrics.apiResponseTimes.filter(a => (now - a.timestamp) < 300000);
    const currentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    
    return {
      sessionId: this.sessionId,
      sessionDuration: Math.round(performance.now() - this.startTime),
      pageLoadTime: Math.round(this.metrics.pageLoadTime),
      averageSearchTime: recentSearches.length > 0 
        ? Math.round(recentSearches.reduce((sum, s) => sum + s.responseTime, 0) / recentSearches.length)
        : 0,
      averageApiTime: recentApi.length > 0
        ? Math.round(recentApi.reduce((sum, a) => sum + a.responseTime, 0) / recentApi.length)
        : 0,
      currentMemoryMB: currentMemory?.usedJSHeapSize || 0,
      errorCount: this.metrics.errorCount,
      interactionCount: this.metrics.userInteractions.length,
      timestamp: now
    };
  }

  // Cleanup method
  cleanup() {
    // Clear intervals
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    
    // Disconnect observers
    Object.values(this.observers.performance || {}).forEach(observer => {
      if (observer?.disconnect) observer.disconnect();
    });
    
    // Send final summary
    this.reportMetric('session_summary', this.getPerformanceSummary());
  }
}

// React Hook
export const usePerformanceMonitoring = (options = {}) => {
  const monitorRef = useRef(null);
  const {
    enabled = process.env.NODE_ENV === 'production',
    sampleRate = 1.0, // Monitor 100% of sessions by default
    componentName = 'Unknown'
  } = options;

  // Initialize monitor
  useEffect(() => {
    if (enabled && Math.random() < sampleRate) {
      monitorRef.current = new PerformanceMonitor();
      
      return () => {
        if (monitorRef.current) {
          monitorRef.current.cleanup();
        }
      };
    }
  }, [enabled, sampleRate]);

  // Track search performance
  const trackSearch = useCallback((searchTerm, startTime, endTime, resultCount) => {
    if (monitorRef.current) {
      monitorRef.current.trackSearchPerformance(searchTerm, startTime, endTime, resultCount);
    }
  }, []);

  // Track API calls
  const trackApiCall = useCallback((endpoint, method, startTime, endTime, status, error) => {
    if (monitorRef.current) {
      monitorRef.current.trackApiCall(endpoint, method, startTime, endTime, status, error);
    }
  }, []);

  // Track render performance
  const trackRender = useCallback((renderTime) => {
    if (monitorRef.current) {
      monitorRef.current.trackRenderPerformance(componentName, renderTime);
    }
  }, [componentName]);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    return monitorRef.current?.getPerformanceSummary() || null;
  }, []);

  // Report custom metric
  const reportMetric = useCallback((metricName, value, tags) => {
    if (monitorRef.current) {
      monitorRef.current.reportMetric(metricName, value, tags);
    }
  }, []);

  return {
    trackSearch,
    trackApiCall,
    trackRender,
    getPerformanceSummary,
    reportMetric,
    isMonitoring: !!monitorRef.current
  };
};

// Higher-order component for automatic render tracking
export const withPerformanceMonitoring = (WrappedComponent, componentName) => {
  return function PerformanceMonitoredComponent(props) {
    const { trackRender } = usePerformanceMonitoring({ componentName });
    const renderStartRef = useRef();
    
    // Track render start
    renderStartRef.current = performance.now();
    
    useEffect(() => {
      // Track render complete
      const renderTime = performance.now() - renderStartRef.current;
      trackRender(renderTime);
    });
    
    return <WrappedComponent {...props} />;
  };
};

export default PerformanceMonitor;