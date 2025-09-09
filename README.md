# Job Tracker Application

A modern job application tracking system built with React, Chakra UI, and Supabase.

## Performance Testing Suite

This application includes a comprehensive performance testing suite to ensure optimal user experience at scale.

### Testing Components

#### 1. Test Data Generation (`scripts/generate-test-data.js`)
- Generates realistic job application data for testing
- Supports 100 to 100,000+ entries
- Includes edge cases and stress test scenarios
- Creates statistically distributed data across companies, positions, and dates

**Usage:**
```bash
npm run test:generate-data [count] [output-file]
npm run test:generate-data 10000 test-jobs.json
```

#### 2. Performance Benchmarks (`scripts/performance-benchmark.js`)
- Measures core performance metrics:
  - Initial load time
  - Search responsiveness
  - Scroll performance (FPS)
  - Memory usage
  - Re-render frequency
- Automated testing with Puppeteer
- Generates detailed performance reports

**Usage:**
```bash
npm run test:benchmark
node scripts/performance-benchmark.js --url http://localhost:5173 --iterations 5
```

#### 3. Stress Testing (`scripts/stress-tests.js`)
- Tests application limits and edge cases:
  - Massive datasets (50k+ records)
  - Concurrent user simulation
  - Memory leak detection
  - Search performance under load
  - Edge case data handling
- Identifies breaking points and performance bottlenecks

**Usage:**
```bash
npm run test:stress
node scripts/stress-tests.js --url http://localhost:5173 --users 25
```

#### 4. Performance Monitoring (`src/hooks/usePerformanceMonitoring.js`)
- Real-time performance monitoring for production
- Tracks key metrics automatically:
  - Page load times
  - Search response times
  - API performance
  - Memory usage
  - User interactions
- Automatic alerting for performance issues

**Usage in React:**
```javascript
import { usePerformanceMonitoring } from './hooks/usePerformanceMonitoring';

function MyComponent() {
  const { trackSearch, trackApiCall, reportMetric } = usePerformanceMonitoring({
    enabled: true,
    componentName: 'JobTable'
  });
  
  // Track search performance
  const handleSearch = (searchTerm) => {
    const startTime = performance.now();
    // ... perform search
    const endTime = performance.now();
    trackSearch(searchTerm, startTime, endTime, results.length);
  };
}
```

#### 5. Monitoring Dashboard (`scripts/monitoring-dashboard.js`)
- Real-time performance dashboard with WebSocket updates
- Visual charts and metrics display
- Alert management and acknowledgment
- Session tracking and analysis
- Historical data and trends

**Usage:**
```bash
npm run test:monitor
# Dashboard available at http://localhost:3001
```

### Performance Success Criteria

#### Core Performance Thresholds
- **Initial Load**: < 2 seconds (excellent: < 1s)
- **Search Response**: < 100ms (excellent: < 50ms)
- **Scroll Performance**: 60 FPS (16.67ms per frame)
- **Memory Usage**: < 50MB per 1000 records
- **API Response**: < 1 second (excellent: < 200ms)

#### Data Size Performance Standards
- **Small (100 items)**: < 200ms load, < 20ms search
- **Medium (1,000 items)**: < 500ms load, < 50ms search  
- **Large (5,000 items)**: < 1.5s load, < 100ms search
- **XLarge (10,000 items)**: < 3s load, < 200ms search
- **Massive (50,000 items)**: < 8s load, < 500ms search

#### Device-Specific Adjustments
- **Desktop**: Baseline performance
- **Laptop**: 50% more lenient thresholds
- **Tablet**: 100% more lenient thresholds  
- **Mobile**: 300% more lenient thresholds

### Running the Full Test Suite

```bash
# Run complete performance test suite
npm run test:full-suite

# Individual test commands
npm run test:generate-data 10000
npm run test:benchmark
npm run test:stress
npm run test:monitor
```

### Test Results and Reports

Test results are automatically saved to:
- `/benchmark-results/` - Performance benchmark reports
- `/test-results/` - Stress test results
- Console output with detailed metrics and recommendations

### Performance Optimization Recommendations

Based on test results, the system provides automatic recommendations:

1. **Large Dataset Optimization**:
   - Implement virtual scrolling
   - Add data pagination
   - Use React.memo() and useMemo()

2. **Search Performance**:
   - Implement search indexing
   - Increase debounce delay
   - Add result caching

3. **Memory Management**:
   - Clean up useEffect hooks
   - Use WeakMap/WeakSet references
   - Implement data compression

4. **Concurrent Users**:
   - Add request throttling
   - Implement loading states
   - Use proper state management

### Monitoring in Production

The performance monitoring system automatically:
- Tracks real-time metrics
- Sends alerts for performance issues  
- Collects user interaction data
- Monitors memory usage and leaks
- Provides session-based analytics

Configure monitoring thresholds in `scripts/performance-criteria.js`.

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Start performance monitoring (optional):
```bash
npm run test:monitor
```

4. Generate test data:
```bash
npm run test:generate-data 1000
```

### Architecture Notes

The application uses:
- **React 19** with Chakra UI for the frontend
- **Supabase** for data persistence
- **Vite** for build tooling
- **Puppeteer** for automated testing
- **WebSockets** for real-time monitoring

Performance optimizations include:
- Debounced search (200ms)
- Memoized components and calculations
- Efficient data structures
- Optimized re-render patterns
- Memory leak prevention

---

For questions or issues with performance testing, check the console output for detailed recommendations and metrics.
