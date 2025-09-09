#!/usr/bin/env node

/**
 * Performance Monitoring Dashboard for Job Tracker Application
 * Real-time performance monitoring and alerting system
 * Usage: node scripts/monitoring-dashboard.js [options]
 */

import express from 'express';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dashboard configuration
const DASHBOARD_CONFIG = {
  port: 3001,
  websocketPort: 3002,
  metricsRetentionDays: 7,
  alertThresholds: {
    pageLoadTime: 3000,        // 3s
    searchResponseTime: 500,   // 500ms
    apiResponseTime: 2000,     // 2s
    memoryUsage: 100,          // 100MB
    errorRate: 0.05,           // 5%
    cpuUsage: 0.8             // 80%
  },
  sampleRates: {
    pageLoads: 1.0,           // 100% of page loads
    searches: 0.1,            // 10% of searches
    apiCalls: 0.5,            // 50% of API calls
    userInteractions: 0.01    // 1% of user interactions
  }
};

class PerformanceDashboard {
  constructor() {
    this.app = express();
    this.wss = null;
    this.metrics = {
      realtime: new Map(),
      historical: [],
      alerts: [],
      sessions: new Map()
    };
    
    this.setupExpress();
    this.setupWebSocket();
    this.setupMetricsCollection();
    this.setupAlertSystem();
  }

  setupExpress() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static(path.join(__dirname, 'public')));

    // Enable CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // Metrics collection endpoint
    this.app.post('/api/metrics', (req, res) => {
      this.handleMetricSubmission(req.body);
      res.json({ status: 'received' });
    });

    // Alerts endpoint
    this.app.post('/api/alerts', (req, res) => {
      this.handleAlertSubmission(req.body);
      res.json({ status: 'received' });
    });

    // Dashboard data endpoints
    this.app.get('/api/dashboard/metrics', (req, res) => {
      res.json(this.getDashboardMetrics());
    });

    this.app.get('/api/dashboard/alerts', (req, res) => {
      res.json(this.getRecentAlerts());
    });

    this.app.get('/api/dashboard/sessions', (req, res) => {
      res.json(this.getActiveSessions());
    });

    // Historical data endpoint
    this.app.get('/api/dashboard/history/:metric', (req, res) => {
      const { metric } = req.params;
      const { timeRange = '1h' } = req.query;
      res.json(this.getHistoricalData(metric, timeRange));
    });

    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    // Dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ 
      port: DASHBOARD_CONFIG.websocketPort,
      perMessageDeflate: false 
    });

    this.wss.on('connection', (ws) => {
      console.log('📱 Dashboard client connected');
      
      // Send initial data
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.getDashboardMetrics()
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      });

      ws.on('close', () => {
        console.log('📱 Dashboard client disconnected');
      });
    });

    console.log(`🌐 WebSocket server running on port ${DASHBOARD_CONFIG.websocketPort}`);
  }

  setupMetricsCollection() {
    // Aggregate metrics every 60 seconds
    setInterval(() => {
      this.aggregateMetrics();
    }, 60000);

    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000);
  }

  setupAlertSystem() {
    // Check for alert conditions every 30 seconds
    setInterval(() => {
      this.checkAlertConditions();
    }, 30000);
  }

  handleMetricSubmission(metric) {
    try {
      const now = Date.now();
      const sessionId = metric.tags?.sessionId;

      // Store real-time metric
      if (!this.metrics.realtime.has(metric.name)) {
        this.metrics.realtime.set(metric.name, []);
      }
      
      const metricData = {
        ...metric,
        receivedAt: now
      };

      this.metrics.realtime.get(metric.name).push(metricData);

      // Track session
      if (sessionId) {
        if (!this.metrics.sessions.has(sessionId)) {
          this.metrics.sessions.set(sessionId, {
            sessionId,
            startTime: now,
            lastActivity: now,
            metrics: [],
            userAgent: metric.tags.userAgent,
            url: metric.tags.url
          });
        }

        const session = this.metrics.sessions.get(sessionId);
        session.lastActivity = now;
        session.metrics.push(metricData);
      }

      // Add to historical data
      this.metrics.historical.push(metricData);

      // Broadcast to dashboard clients
      this.broadcastMetric(metricData);

      // Limit real-time data size
      this.metrics.realtime.forEach((metrics, name) => {
        if (metrics.length > 1000) {
          metrics.splice(0, metrics.length - 1000);
        }
      });

    } catch (error) {
      console.error('Error handling metric submission:', error);
    }
  }

  handleAlertSubmission(alert) {
    try {
      const alertData = {
        ...alert,
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        receivedAt: Date.now(),
        acknowledged: false
      };

      this.metrics.alerts.push(alertData);

      // Limit alerts storage
      if (this.metrics.alerts.length > 1000) {
        this.metrics.alerts.shift();
      }

      // Broadcast alert to dashboard
      this.broadcastAlert(alertData);

      console.log(`🚨 Alert received: ${alert.type} from session ${alert.sessionId?.slice(-8)}`);

    } catch (error) {
      console.error('Error handling alert submission:', error);
    }
  }

  broadcastMetric(metric) {
    const message = JSON.stringify({
      type: 'metric',
      data: metric
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastAlert(alert) {
    const message = JSON.stringify({
      type: 'alert',
      data: alert
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  getDashboardMetrics() {
    const now = Date.now();
    const last5Minutes = now - (5 * 60 * 1000);
    const last1Hour = now - (60 * 60 * 1000);

    // Get recent metrics
    const recentMetrics = this.metrics.historical.filter(m => m.receivedAt > last5Minutes);
    const hourlyMetrics = this.metrics.historical.filter(m => m.receivedAt > last1Hour);

    // Calculate aggregated metrics
    const pageLoadTimes = recentMetrics.filter(m => m.name === 'page_load_time').map(m => m.value);
    const searchTimes = recentMetrics.filter(m => m.name === 'search_response_time').map(m => m.value);
    const apiTimes = recentMetrics.filter(m => m.name === 'api_response_time').map(m => m.value);

    const calculate = (values) => ({
      count: values.length,
      avg: values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0,
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      p95: values.length > 0 ? this.percentile(values, 95) : 0
    });

    return {
      timestamp: now,
      activeSessions: this.metrics.sessions.size,
      totalMetrics: this.metrics.historical.length,
      recentAlerts: this.metrics.alerts.filter(a => a.receivedAt > last1Hour).length,
      
      performance: {
        pageLoad: calculate(pageLoadTimes),
        search: calculate(searchTimes),
        api: calculate(apiTimes)
      },
      
      system: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      
      timeRanges: {
        last5Minutes: recentMetrics.length,
        lastHour: hourlyMetrics.length
      }
    };
  }

  getRecentAlerts(limit = 50) {
    return this.metrics.alerts
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .slice(0, limit);
  }

  getActiveSessions() {
    const now = Date.now();
    const activeThreshold = 30 * 60 * 1000; // 30 minutes

    return Array.from(this.metrics.sessions.values())
      .filter(session => (now - session.lastActivity) < activeThreshold)
      .map(session => ({
        sessionId: session.sessionId,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        duration: now - session.startTime,
        metricCount: session.metrics.length,
        userAgent: session.userAgent?.slice(0, 50) + '...',
        url: session.url
      }));
  }

  getHistoricalData(metricName, timeRange) {
    const now = Date.now();
    let startTime;

    switch (timeRange) {
      case '1h': startTime = now - (60 * 60 * 1000); break;
      case '6h': startTime = now - (6 * 60 * 60 * 1000); break;
      case '24h': startTime = now - (24 * 60 * 60 * 1000); break;
      case '7d': startTime = now - (7 * 24 * 60 * 60 * 1000); break;
      default: startTime = now - (60 * 60 * 1000);
    }

    return this.metrics.historical
      .filter(m => m.name === metricName && m.receivedAt > startTime)
      .map(m => ({
        timestamp: m.receivedAt,
        value: m.value
      }));
  }

  aggregateMetrics() {
    // This would typically save aggregated metrics to a time-series database
    console.log(`📊 Aggregated metrics - Active sessions: ${this.metrics.sessions.size}, Total metrics: ${this.metrics.historical.length}`);
  }

  cleanupOldData() {
    const cutoff = Date.now() - (DASHBOARD_CONFIG.metricsRetentionDays * 24 * 60 * 60 * 1000);
    
    // Clean historical metrics
    this.metrics.historical = this.metrics.historical.filter(m => m.receivedAt > cutoff);
    
    // Clean old sessions
    this.metrics.sessions.forEach((session, sessionId) => {
      if (session.lastActivity < cutoff) {
        this.metrics.sessions.delete(sessionId);
      }
    });
    
    // Clean old alerts
    this.metrics.alerts = this.metrics.alerts.filter(a => a.receivedAt > cutoff);
    
    console.log(`🧹 Cleaned up old data - Retention: ${DASHBOARD_CONFIG.metricsRetentionDays} days`);
  }

  checkAlertConditions() {
    const now = Date.now();
    const last5Minutes = now - (5 * 60 * 1000);
    const recentMetrics = this.metrics.historical.filter(m => m.receivedAt > last5Minutes);

    // Check page load time threshold
    const pageLoadTimes = recentMetrics.filter(m => m.name === 'page_load_time').map(m => m.value);
    if (pageLoadTimes.length > 0) {
      const avgPageLoad = pageLoadTimes.reduce((sum, v) => sum + v, 0) / pageLoadTimes.length;
      if (avgPageLoad > DASHBOARD_CONFIG.alertThresholds.pageLoadTime) {
        this.triggerAlert('high_page_load_time', { average: avgPageLoad, threshold: DASHBOARD_CONFIG.alertThresholds.pageLoadTime });
      }
    }

    // Check search response time
    const searchTimes = recentMetrics.filter(m => m.name === 'search_response_time').map(m => m.value);
    if (searchTimes.length > 0) {
      const avgSearch = searchTimes.reduce((sum, v) => sum + v, 0) / searchTimes.length;
      if (avgSearch > DASHBOARD_CONFIG.alertThresholds.searchResponseTime) {
        this.triggerAlert('high_search_response_time', { average: avgSearch, threshold: DASHBOARD_CONFIG.alertThresholds.searchResponseTime });
      }
    }
  }

  triggerAlert(type, data) {
    const alert = {
      id: `system_alert_${Date.now()}`,
      type,
      data,
      source: 'dashboard',
      timestamp: Date.now(),
      receivedAt: Date.now(),
      acknowledged: false
    };

    this.metrics.alerts.push(alert);
    this.broadcastAlert(alert);
    
    console.log(`🚨 System alert triggered: ${type}`, data);
  }

  percentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'acknowledge_alert':
        this.acknowledgeAlert(data.alertId);
        break;
      case 'request_metric_history':
        const history = this.getHistoricalData(data.metricName, data.timeRange);
        ws.send(JSON.stringify({
          type: 'metric_history',
          metric: data.metricName,
          data: history
        }));
        break;
    }
  }

  acknowledgeAlert(alertId) {
    const alert = this.metrics.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      
      this.broadcastAlert({ ...alert, type: 'alert_acknowledged' });
    }
  }

  getDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Tracker - Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .header .status {
            font-size: 0.9rem;
            opacity: 0.9;
            margin-top: 0.25rem;
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }
        
        .card:hover {
            transform: translateY(-2px);
        }
        
        .card h2 {
            font-size: 1.2rem;
            margin-bottom: 1rem;
            color: #555;
            border-bottom: 2px solid #eee;
            padding-bottom: 0.5rem;
        }
        
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .metric {
            text-align: center;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .metric-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #2563eb;
        }
        
        .metric-label {
            font-size: 0.85rem;
            color: #666;
            margin-top: 0.25rem;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 1rem;
        }
        
        .alerts {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .alert {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            border-left: 4px solid #ef4444;
            background: #fef2f2;
            border-radius: 4px;
        }
        
        .alert.warning {
            border-left-color: #f59e0b;
            background: #fffbeb;
        }
        
        .alert.info {
            border-left-color: #3b82f6;
            background: #eff6ff;
        }
        
        .alert-time {
            font-size: 0.8rem;
            color: #666;
            margin-bottom: 0.25rem;
        }
        
        .sessions {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .session {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #10b981;
        }
        
        .session-id {
            font-weight: 600;
            color: #059669;
        }
        
        .session-details {
            font-size: 0.85rem;
            color: #666;
            margin-top: 0.25rem;
        }
        
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            margin-right: 0.5rem;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Job Tracker Performance Dashboard</h1>
        <div class="status">
            <span class="status-indicator"></span>
            Real-time monitoring active
        </div>
    </div>
    
    <div class="dashboard">
        <div class="card">
            <h2>🏃‍♂️ Real-time Metrics</h2>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-value" id="activeSessions">-</div>
                    <div class="metric-label">Active Sessions</div>
                </div>
                <div class="metric">
                    <div class="metric-value" id="avgPageLoad">-</div>
                    <div class="metric-label">Avg Page Load (ms)</div>
                </div>
                <div class="metric">
                    <div class="metric-value" id="avgSearch">-</div>
                    <div class="metric-label">Avg Search (ms)</div>
                </div>
                <div class="metric">
                    <div class="metric-value" id="totalMetrics">-</div>
                    <div class="metric-label">Total Metrics</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>📈 Performance Chart</h2>
            <div class="chart-container">
                <canvas id="performanceChart"></canvas>
            </div>
        </div>
        
        <div class="card">
            <h2>🚨 Recent Alerts</h2>
            <div class="alerts" id="alertsList">
                <p>No recent alerts</p>
            </div>
        </div>
        
        <div class="card">
            <h2>👥 Active Sessions</h2>
            <div class="sessions" id="sessionsList">
                <p>No active sessions</p>
            </div>
        </div>
    </div>
    
    <div class="footer">
        Job Tracker Performance Dashboard - Real-time monitoring and alerting
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:${DASHBOARD_CONFIG.websocketPort}');
        let performanceChart;
        const chartData = {
            pageLoad: [],
            search: [],
            api: []
        };
        
        // Initialize performance chart
        const ctx = document.getElementById('performanceChart').getContext('2d');
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Page Load Time (ms)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Search Response (ms)',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Time (ms)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'initial':
                    updateDashboard(message.data);
                    break;
                case 'metric':
                    handleNewMetric(message.data);
                    break;
                case 'alert':
                    handleNewAlert(message.data);
                    break;
            }
        };
        
        function updateDashboard(data) {
            document.getElementById('activeSessions').textContent = data.activeSessions || 0;
            document.getElementById('avgPageLoad').textContent = Math.round(data.performance?.pageLoad?.avg || 0);
            document.getElementById('avgSearch').textContent = Math.round(data.performance?.search?.avg || 0);
            document.getElementById('totalMetrics').textContent = data.totalMetrics || 0;
        }
        
        function handleNewMetric(metric) {
            const time = new Date(metric.receivedAt).toLocaleTimeString();
            
            // Update chart data
            if (metric.name === 'page_load_time') {
                updateChart(0, time, metric.value);
            } else if (metric.name === 'search_response_time') {
                updateChart(1, time, metric.value);
            }
        }
        
        function updateChart(datasetIndex, label, value) {
            const chart = performanceChart;
            
            // Add new data point
            chart.data.labels.push(label);
            chart.data.datasets[datasetIndex].data.push(value);
            
            // Keep only last 50 data points
            if (chart.data.labels.length > 50) {
                chart.data.labels.shift();
                chart.data.datasets.forEach(dataset => dataset.data.shift());
            }
            
            chart.update('none');
        }
        
        function handleNewAlert(alert) {
            const alertsList = document.getElementById('alertsList');
            const alertDiv = document.createElement('div');
            alertDiv.className = \`alert \${alert.type === 'warning' ? 'warning' : 'error'}\`;
            alertDiv.innerHTML = \`
                <div class="alert-time">\${new Date(alert.receivedAt).toLocaleString()}</div>
                <div><strong>\${alert.type}:</strong> \${JSON.stringify(alert.data)}</div>
            \`;
            
            alertsList.insertBefore(alertDiv, alertsList.firstChild);
            
            // Keep only last 10 alerts visible
            while (alertsList.children.length > 10) {
                alertsList.removeChild(alertsList.lastChild);
            }
        }
        
        // Fetch initial data
        fetch('/api/dashboard/metrics')
            .then(response => response.json())
            .then(data => updateDashboard(data))
            .catch(error => console.error('Error fetching dashboard data:', error));
            
        // Fetch alerts
        fetch('/api/dashboard/alerts')
            .then(response => response.json())
            .then(alerts => {
                alerts.slice(0, 10).forEach(alert => handleNewAlert(alert));
            })
            .catch(error => console.error('Error fetching alerts:', error));
    </script>
</body>
</html>
    `;
  }

  start() {
    this.app.listen(DASHBOARD_CONFIG.port, () => {
      console.log(`🚀 Performance Dashboard started:`);
      console.log(`   📊 Dashboard: http://localhost:${DASHBOARD_CONFIG.port}`);
      console.log(`   🔌 WebSocket: ws://localhost:${DASHBOARD_CONFIG.websocketPort}`);
      console.log(`   📈 API: http://localhost:${DASHBOARD_CONFIG.port}/api`);
      console.log('');
      console.log('📋 Available endpoints:');
      console.log('   POST /api/metrics - Submit performance metrics');
      console.log('   POST /api/alerts - Submit performance alerts');
      console.log('   GET  /api/dashboard/metrics - Get dashboard data');
      console.log('   GET  /api/health - Health check');
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📊 Job Tracker Performance Monitoring Dashboard

Usage: node scripts/monitoring-dashboard.js [options]

Options:
  --port <port>       Dashboard port (default: 3001)
  --ws-port <port>    WebSocket port (default: 3002)
  --help, -h          Show this help message

Example:
  node scripts/monitoring-dashboard.js --port 4000 --ws-port 4001
    `);
    return;
  }
  
  // Parse command line arguments
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && portIndex + 1 < args.length) {
    DASHBOARD_CONFIG.port = parseInt(args[portIndex + 1]) || DASHBOARD_CONFIG.port;
  }
  
  const wsPortIndex = args.indexOf('--ws-port');
  if (wsPortIndex !== -1 && wsPortIndex + 1 < args.length) {
    DASHBOARD_CONFIG.websocketPort = parseInt(args[wsPortIndex + 1]) || DASHBOARD_CONFIG.websocketPort;
  }
  
  const dashboard = new PerformanceDashboard();
  dashboard.start();
  
  // Handle shutdown gracefully
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down dashboard...');
    process.exit(0);
  });
}

export { PerformanceDashboard, DASHBOARD_CONFIG };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Dashboard startup failed:', error);
    process.exit(1);
  });
}