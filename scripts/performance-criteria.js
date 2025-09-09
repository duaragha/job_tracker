#!/usr/bin/env node

/**
 * Performance Success Criteria and Thresholds Definition
 * Comprehensive performance standards for the Job Tracker Application
 */

export const PERFORMANCE_CRITERIA = {
  // Core Performance Metrics
  CORE_METRICS: {
    initialLoad: {
      excellent: 1000,     // < 1s - Excellent user experience
      good: 2000,         // < 2s - Good user experience  
      acceptable: 3000,   // < 3s - Acceptable but needs improvement
      poor: 5000,         // < 5s - Poor, requires optimization
      critical: Infinity  // > 5s - Critical performance issue
    },
    
    dataLoad: {
      excellent: 500,     // < 500ms for data fetching
      good: 1000,        // < 1s
      acceptable: 2000,  // < 2s
      poor: 3000,        // < 3s
      critical: Infinity
    },
    
    searchResponse: {
      excellent: 50,      // < 50ms - Instant feel
      good: 100,         // < 100ms - Very responsive
      acceptable: 200,   // < 200ms - Acceptable
      poor: 500,         // < 500ms - Sluggish
      critical: Infinity
    },
    
    scrollPerformance: {
      excellent: 8.33,    // 120fps
      good: 16.67,       // 60fps - Target for smooth scrolling
      acceptable: 33.33, // 30fps - Minimum acceptable
      poor: 66.67,       // 15fps - Choppy
      critical: Infinity
    }
  },

  // Memory Performance Standards
  MEMORY_CRITERIA: {
    baselineUsage: {
      excellent: 10,      // < 10MB baseline
      good: 20,          // < 20MB
      acceptable: 50,    // < 50MB
      poor: 100,         // < 100MB
      critical: Infinity
    },
    
    memoryPerThousandItems: {
      excellent: 5,       // < 5MB per 1000 items
      good: 10,          // < 10MB per 1000 items
      acceptable: 25,    // < 25MB per 1000 items
      poor: 50,          // < 50MB per 1000 items
      critical: Infinity
    },
    
    memoryLeakRate: {
      excellent: 1,       // < 1MB/minute during normal usage
      good: 5,           // < 5MB/minute
      acceptable: 10,    // < 10MB/minute
      poor: 20,          // < 20MB/minute
      critical: Infinity
    }
  },

  // Data Size Performance Standards
  DATA_SIZE_CRITERIA: {
    small: {
      size: 100,
      loadTime: 200,      // < 200ms for 100 items
      searchTime: 20,     // < 20ms search
      scrollFps: 60
    },
    
    medium: {
      size: 1000,
      loadTime: 500,      // < 500ms for 1000 items
      searchTime: 50,     // < 50ms search
      scrollFps: 60
    },
    
    large: {
      size: 5000,
      loadTime: 1500,     // < 1.5s for 5000 items
      searchTime: 100,    // < 100ms search
      scrollFps: 45
    },
    
    xlarge: {
      size: 10000,
      loadTime: 3000,     // < 3s for 10000 items
      searchTime: 200,    // < 200ms search
      scrollFps: 30
    },
    
    massive: {
      size: 50000,
      loadTime: 8000,     // < 8s for 50000 items
      searchTime: 500,    // < 500ms search
      scrollFps: 30
    }
  },

  // User Interaction Standards
  INTERACTION_CRITERIA: {
    clickResponse: {
      excellent: 50,      // < 50ms for button clicks
      good: 100,         // < 100ms
      acceptable: 200,   // < 200ms
      poor: 500,         // < 500ms
      critical: Infinity
    },
    
    inputLag: {
      excellent: 20,      // < 20ms input to display
      good: 50,          // < 50ms
      acceptable: 100,   // < 100ms
      poor: 200,         // < 200ms
      critical: Infinity
    },
    
    rerenderFrequency: {
      excellent: 2,       // < 2 rerenders per user action
      good: 5,           // < 5 rerenders
      acceptable: 10,    // < 10 rerenders
      poor: 20,          // < 20 rerenders
      critical: Infinity
    }
  },

  // Network Performance Standards
  NETWORK_CRITERIA: {
    apiResponse: {
      excellent: 200,     // < 200ms API response
      good: 500,         // < 500ms
      acceptable: 1000,  // < 1s
      poor: 2000,        // < 2s
      critical: Infinity
    },
    
    bundleSize: {
      excellent: 500,     // < 500KB total bundle
      good: 1000,        // < 1MB
      acceptable: 2000,  // < 2MB
      poor: 5000,        // < 5MB
      critical: Infinity  // > 5MB
    }
  },

  // Device Performance Standards
  DEVICE_CRITERIA: {
    desktop: {
      cpu: 'high',
      memory: 'high',
      network: 'broadband',
      multiplier: 1.0     // Baseline performance
    },
    
    laptop: {
      cpu: 'medium',
      memory: 'medium',
      network: 'wifi',
      multiplier: 1.5     // 50% more lenient
    },
    
    tablet: {
      cpu: 'medium',
      memory: 'low',
      network: 'wifi',
      multiplier: 2.0     // 100% more lenient
    },
    
    mobile: {
      cpu: 'low',
      memory: 'low',
      network: '3g',
      multiplier: 3.0     // 300% more lenient
    }
  }
};

// Test Scenarios and Expected Performance
export const TEST_SCENARIOS = {
  // Smoke Tests - Basic functionality
  SMOKE_TESTS: [
    {
      name: 'App Loads Successfully',
      description: 'Application loads without errors',
      criteria: 'initialLoad.good',
      critical: true
    },
    {
      name: 'Basic Search Works',
      description: 'Search functionality responds to input',
      criteria: 'searchResponse.acceptable',
      critical: true
    },
    {
      name: 'Table Renders',
      description: 'Job table renders with data',
      criteria: 'dataLoad.acceptable',
      critical: true
    }
  ],

  // Performance Tests - Core performance metrics
  PERFORMANCE_TESTS: [
    {
      name: 'Fast Initial Load',
      description: 'Application loads quickly on first visit',
      criteria: 'initialLoad.good',
      dataSize: 'medium'
    },
    {
      name: 'Responsive Search',
      description: 'Search responds quickly to user input',
      criteria: 'searchResponse.good',
      dataSize: 'large'
    },
    {
      name: 'Smooth Scrolling',
      description: 'Scrolling maintains 60fps',
      criteria: 'scrollPerformance.good',
      dataSize: 'large'
    },
    {
      name: 'Memory Efficiency',
      description: 'Memory usage stays within acceptable limits',
      criteria: 'memoryPerThousandItems.good',
      dataSize: 'xlarge'
    }
  ],

  // Stress Tests - Edge cases and limits
  STRESS_TESTS: [
    {
      name: 'Large Dataset Load',
      description: 'Application handles 50k+ records',
      criteria: 'massive',
      timeout: 15000
    },
    {
      name: 'Heavy Search Load',
      description: 'Search performs well with large datasets',
      criteria: 'searchResponse.acceptable',
      dataSize: 'massive'
    },
    {
      name: 'Memory Stress',
      description: 'No memory leaks during extended usage',
      criteria: 'memoryLeakRate.good',
      duration: 300000 // 5 minutes
    },
    {
      name: 'Rapid Interactions',
      description: 'App remains responsive during rapid user inputs',
      criteria: 'inputLag.acceptable',
      interactions: 100
    }
  ],

  // Regression Tests - Ensure no performance degradation
  REGRESSION_TESTS: [
    {
      name: 'Performance Baseline',
      description: 'Current performance matches or exceeds baseline',
      baseline: true,
      tolerance: 0.1 // 10% tolerance
    },
    {
      name: 'Feature Addition Impact',
      description: 'New features don\'t significantly impact performance',
      maxImpact: 0.2 // 20% max performance impact
    }
  ]
};

// Performance Monitoring Configuration
export const MONITORING_CONFIG = {
  // Metrics to track in production
  PRODUCTION_METRICS: [
    'page_load_time',
    'search_response_time',
    'api_response_time',
    'memory_usage',
    'error_rate',
    'user_interactions_per_second'
  ],

  // Alert thresholds for production monitoring
  ALERT_THRESHOLDS: {
    page_load_time: 5000,        // Alert if load time > 5s
    search_response_time: 1000,  // Alert if search > 1s
    api_response_time: 2000,     // Alert if API > 2s
    memory_usage: 100,           // Alert if memory > 100MB
    error_rate: 0.05,           // Alert if error rate > 5%
    cpu_usage: 0.8              // Alert if CPU > 80%
  },

  // Sampling rates for different metrics
  SAMPLING_RATES: {
    page_loads: 1.0,            // Track all page loads
    searches: 0.1,              // Track 10% of searches
    scrolls: 0.01,              // Track 1% of scroll events
    clicks: 0.05                // Track 5% of clicks
  }
};

// Performance Budget - Resource limits
export const PERFORMANCE_BUDGET = {
  // Bundle Size Limits
  BUNDLE_SIZES: {
    main_bundle: 1000,          // 1MB max for main bundle
    vendor_bundle: 2000,        // 2MB max for vendor bundle
    async_chunks: 500,          // 500KB max per async chunk
    total_initial: 2000,        // 2MB max total initial load
    total_application: 5000     // 5MB max total application size
  },

  // Network Resource Limits
  NETWORK_RESOURCES: {
    total_requests: 50,         // Max 50 requests for initial load
    image_total_size: 2000,     // 2MB max for all images
    font_total_size: 500,       // 500KB max for fonts
    critical_path_requests: 10   // Max 10 critical path requests
  },

  // Runtime Performance Limits
  RUNTIME_LIMITS: {
    main_thread_blocking: 50,   // Max 50ms main thread blocking
    layout_shift: 0.1,          // Max 0.1 Cumulative Layout Shift
    first_input_delay: 100,     // Max 100ms First Input Delay
    interaction_latency: 200    // Max 200ms interaction to next paint
  }
};

// Utility functions for performance evaluation
export class PerformanceEvaluator {
  static evaluateMetric(value, criteria, device = 'desktop') {
    const multiplier = PERFORMANCE_CRITERIA.DEVICE_CRITERIA[device]?.multiplier || 1.0;
    const adjustedCriteria = this.adjustCriteriaForDevice(criteria, multiplier);
    
    if (value <= adjustedCriteria.excellent) return { grade: 'A+', level: 'excellent' };
    if (value <= adjustedCriteria.good) return { grade: 'A', level: 'good' };
    if (value <= adjustedCriteria.acceptable) return { grade: 'B', level: 'acceptable' };
    if (value <= adjustedCriteria.poor) return { grade: 'C', level: 'poor' };
    return { grade: 'F', level: 'critical' };
  }
  
  static adjustCriteriaForDevice(criteria, multiplier) {
    return {
      excellent: criteria.excellent * multiplier,
      good: criteria.good * multiplier,
      acceptable: criteria.acceptable * multiplier,
      poor: criteria.poor * multiplier,
      critical: criteria.critical
    };
  }
  
  static generatePerformanceReport(results) {
    const report = {
      overall_grade: 'A',
      total_score: 0,
      category_scores: {},
      recommendations: [],
      critical_issues: [],
      warnings: []
    };
    
    // Calculate scores and generate recommendations
    Object.entries(results).forEach(([category, metrics]) => {
      const categoryScore = this.calculateCategoryScore(metrics);
      report.category_scores[category] = categoryScore;
      
      if (categoryScore.grade === 'F') {
        report.critical_issues.push(`Critical performance issue in ${category}`);
      } else if (categoryScore.grade === 'C') {
        report.warnings.push(`Performance warning in ${category}`);
      }
    });
    
    return report;
  }
  
  static calculateCategoryScore(metrics) {
    const scores = Object.values(metrics).map(metric => {
      const evaluation = this.evaluateMetric(metric.value, metric.criteria);
      return this.gradeToScore(evaluation.grade);
    });
    
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return {
      score: avgScore,
      grade: this.scoreToGrade(avgScore)
    };
  }
  
  static gradeToScore(grade) {
    const gradeMap = { 'A+': 100, 'A': 90, 'B': 80, 'C': 70, 'F': 0 };
    return gradeMap[grade] || 0;
  }
  
  static scoreToGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 65) return 'C';
    return 'F';
  }
}

// Export main configuration object
export default {
  PERFORMANCE_CRITERIA,
  TEST_SCENARIOS,
  MONITORING_CONFIG,
  PERFORMANCE_BUDGET,
  PerformanceEvaluator
};