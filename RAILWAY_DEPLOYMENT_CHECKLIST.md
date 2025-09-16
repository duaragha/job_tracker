# Railway Deployment Checklist for Job Tracker Application

## Overview
This checklist covers the complete deployment process for the Job Tracker React application from development to Railway production environment.

**Application Stack:**
- Frontend: React 19 + Vite + Chakra UI
- Backend: Supabase (PostgreSQL database)
- Build Tool: Vite
- Package Manager: npm

---

## 1. Pre-Migration Backup Procedures

### 1.1 Code Repository Backup
- [ ] **Create deployment branch**: `git checkout -b railway-deployment`
- [ ] **Tag current version**: `git tag -a v1.0.0-pre-railway -m "Pre-Railway deployment version"`
- [ ] **Push to remote**: `git push origin railway-deployment --tags`
- [ ] **Create repository backup**: Download complete repository as ZIP
- [ ] **Document current commit hash**: Record SHA for rollback reference

### 1.2 Database Backup (Supabase)
- [ ] **Export Supabase schema**:
  - Navigate to Supabase Dashboard > SQL Editor
  - Run: `pg_dump --schema-only --no-owner --no-privileges`
  - Save schema to `backup/schema-$(date +%Y%m%d).sql`
- [ ] **Export data**:
  - Use Supabase Dashboard > Database > Backups
  - Create manual backup snapshot
  - Download CSV exports of critical tables
- [ ] **Document database URL and keys**: Store in secure location
- [ ] **Test backup restoration**: Verify backup integrity on test environment

### 1.3 Environment Configuration Backup
- [ ] **Copy .env file**: `cp .env .env.backup.$(date +%Y%m%d)`
- [ ] **Document all environment variables**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- [ ] **Export Supabase project settings**: API keys, RLS policies, auth settings
- [ ] **Document DNS settings**: Current domain configuration (if applicable)

---

## 2. Railway Project Setup Steps

### 2.1 Railway Account and CLI Setup
- [ ] **Create Railway account**: Sign up at railway.app
- [ ] **Install Railway CLI**: `npm install -g @railway/cli`
- [ ] **Login to Railway**: `railway login`
- [ ] **Verify CLI access**: `railway whoami`

### 2.2 Project Initialization
- [ ] **Create new Railway project**: `railway init`
- [ ] **Select starter template**: Choose "Deploy from GitHub repo"
- [ ] **Connect GitHub repository**: Link your job tracker repository
- [ ] **Select branch**: Choose `railway-deployment` branch
- [ ] **Configure project name**: Set to "job-tracker-prod"

### 2.3 Service Configuration
- [ ] **Configure build settings**:
  ```bash
  # Add to railway.toml or set in dashboard
  [build]
  builder = "nixpacks"

  [deploy]
  startCommand = "npm run preview"
  ```
- [ ] **Set Node.js version**: Ensure Node 18+ in package.json engines
- [ ] **Configure port**: Railway auto-assigns, ensure Vite serves on `0.0.0.0`

---

## 3. Database Schema Migration Steps

### 3.1 Supabase Project Assessment
- [ ] **Inventory existing tables**: Document all tables, views, functions
- [ ] **Review RLS policies**: Document row-level security settings
- [ ] **Check custom functions**: Document any PostgreSQL functions/triggers
- [ ] **Assess storage usage**: Document file storage requirements

### 3.2 Migration Strategy Decision
- [ ] **Option A - Keep existing Supabase**:
  - Maintain current Supabase project
  - Update CORS settings for new Railway domain
  - No migration required
- [ ] **Option B - New Supabase project**:
  - Create fresh Supabase project
  - Import schema and data
  - Update environment variables

### 3.3 Schema Validation (if migrating)
- [ ] **Create new Supabase project**: For production use
- [ ] **Import schema**: Run backed-up schema SQL
- [ ] **Verify table structure**: Confirm all tables created correctly
- [ ] **Test relationships**: Verify foreign keys and constraints
- [ ] **Apply RLS policies**: Recreate security policies

---

## 4. Data Migration Procedures

### 4.1 Data Transfer Planning
- [ ] **Estimate data volume**: Check current database size
- [ ] **Plan downtime window**: Schedule migration during low usage
- [ ] **Prepare rollback plan**: Document reversal procedures

### 4.2 Data Export/Import (if using new Supabase)
- [ ] **Export data via SQL**:
  ```sql
  COPY (SELECT * FROM jobs) TO '/tmp/jobs.csv' WITH CSV HEADER;
  COPY (SELECT * FROM job_applications) TO '/tmp/applications.csv' WITH CSV HEADER;
  ```
- [ ] **Import to new database**: Use Supabase Dashboard or SQL commands
- [ ] **Verify data integrity**: Compare row counts and key records
- [ ] **Test application functionality**: Ensure all features work with migrated data

### 4.3 Data Sync Verification
- [ ] **Run data validation queries**: Check for missing records
- [ ] **Test user authentication**: Verify auth.users data if applicable
- [ ] **Validate file uploads**: Ensure storage bucket contents transferred
- [ ] **Check audit logs**: Verify timestamps and metadata preserved

---

## 5. Environment Variable Configuration

### 5.1 Railway Environment Setup
- [ ] **Access Railway dashboard**: Navigate to project settings
- [ ] **Configure production variables**:
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  NODE_ENV=production
  ```
- [ ] **Set build variables** (if needed):
  ```
  BUILD_COMMAND=npm run build
  START_COMMAND=npm run preview
  ```

### 5.2 Supabase Configuration Updates
- [ ] **Update CORS settings**: Add Railway domain to allowed origins
- [ ] **Configure auth redirects**: Update allowed redirect URLs
- [ ] **Update RLS policies**: Ensure they work with new domain
- [ ] **Test API access**: Verify Supabase connection from Railway

### 5.3 Security Configuration
- [ ] **Enable HTTPS**: Railway provides SSL by default
- [ ] **Configure CSP headers**: Update Content Security Policy if applicable
- [ ] **Review API key security**: Ensure anon key is properly scoped
- [ ] **Set up monitoring**: Configure error tracking and alerts

---

## 6. DNS and Domain Transfer Steps

### 6.1 Railway Domain Setup
- [ ] **Note Railway domain**: Record auto-generated `.railway.app` domain
- [ ] **Test Railway deployment**: Verify application loads on Railway domain
- [ ] **Configure custom domain** (if needed): Add your domain in Railway settings

### 6.2 Custom Domain Configuration (Optional)
- [ ] **Add domain to Railway**: In project settings > Domains
- [ ] **Configure DNS records**:
  - A record: Point to Railway IP
  - CNAME record: Point to Railway domain
- [ ] **Update SSL certificates**: Railway handles automatically
- [ ] **Test domain propagation**: Use `dig` or online tools

### 6.3 Legacy Domain Management
- [ ] **Document current DNS**: Record existing domain configuration
- [ ] **Plan domain transition**: Schedule DNS updates for minimal downtime
- [ ] **Set up redirects**: Implement 301 redirects if changing domains
- [ ] **Update external references**: Update any hardcoded domain references

---

## 7. Post-Migration Validation Tests

### 7.1 Application Functionality Tests
- [ ] **Test homepage load**: Verify main application loads
- [ ] **Test job creation**: Create new job entry
- [ ] **Test job editing**: Modify existing job
- [ ] **Test job deletion**: Remove test job
- [ ] **Test bulk operations**: Verify bulk edit functionality
- [ ] **Test search functionality**: Search and filter jobs
- [ ] **Test export features**: Download job data
- [ ] **Test responsive design**: Check mobile/tablet views

### 7.2 Database Connectivity Tests
- [ ] **Test read operations**: Fetch job listings
- [ ] **Test write operations**: Create/update records
- [ ] **Test complex queries**: Verify filtering and sorting
- [ ] **Test error handling**: Verify graceful failure handling
- [ ] **Test concurrent access**: Simulate multiple users

### 7.3 Authentication & Security Tests (if applicable)
- [ ] **Test user registration**: Create new accounts
- [ ] **Test user login**: Authenticate existing users
- [ ] **Test session management**: Verify session persistence
- [ ] **Test data isolation**: Ensure user data separation
- [ ] **Test API security**: Verify RLS policies working

### 7.4 Integration Tests
- [ ] **Test external APIs**: Verify any third-party integrations
- [ ] **Test email notifications**: If email features exist
- [ ] **Test file uploads**: Verify storage functionality
- [ ] **Test data export/import**: Verify backup/restore capabilities

---

## 8. Performance Benchmarking Steps

### 8.1 Baseline Performance Measurement
- [ ] **Measure page load times**: Use browser dev tools
- [ ] **Test with existing performance scripts**:
  ```bash
  npm run test:benchmark
  npm run test:stress
  ```
- [ ] **Monitor JavaScript bundle size**: Check build output
- [ ] **Measure API response times**: Test Supabase query performance

### 8.2 Load Testing
- [ ] **Simulate concurrent users**: Use existing stress test script
- [ ] **Test database performance**: Monitor query execution times
- [ ] **Test memory usage**: Monitor Railway container metrics
- [ ] **Test large dataset handling**: Use test data generation script

### 8.3 Optimization Verification
- [ ] **Verify code splitting**: Check for proper chunk loading
- [ ] **Test lazy loading**: Verify components load on demand
- [ ] **Monitor bundle optimization**: Ensure tree-shaking working
- [ ] **Test caching**: Verify browser and CDN caching

### 8.4 Monitoring Setup
- [ ] **Configure Railway metrics**: Enable built-in monitoring
- [ ] **Set up error tracking**: Configure error logging
- [ ] **Monitor database performance**: Set up Supabase monitoring
- [ ] **Configure alerts**: Set up notifications for issues
- [ ] **Create performance dashboard**: Aggregate key metrics

---

## Rollback Procedures

### Emergency Rollback Plan
- [ ] **DNS rollback**: Revert DNS to previous configuration
- [ ] **Database rollback**: Restore from backup if data migration occurred
- [ ] **Code rollback**: Deploy previous version tag
- [ ] **Environment rollback**: Restore previous environment variables
- [ ] **Monitoring**: Watch for issues during rollback

---

## Post-Deployment Tasks

### 8.5 Final Verification
- [ ] **User acceptance testing**: Have stakeholders test key workflows
- [ ] **Performance monitoring**: Monitor for 24-48 hours
- [ ] **Error rate monitoring**: Ensure error rates within acceptable limits
- [ ] **Documentation updates**: Update deployment documentation
- [ ] **Team notification**: Inform team of successful deployment

### 8.6 Cleanup
- [ ] **Remove deployment branch**: After successful deployment
- [ ] **Archive old backups**: Store securely for future reference
- [ ] **Update deployment docs**: Document lessons learned
- [ ] **Schedule regular backups**: Set up automated backup procedures

---

## Emergency Contacts and Resources

- **Railway Support**: support@railway.app
- **Supabase Support**: support@supabase.com
- **Project Repository**: [GitHub URL]
- **Team Lead**: [Contact Information]
- **Database Admin**: [Contact Information]

---

## Verification Sign-off

| Task Category | Completed By | Date | Signature |
|---------------|--------------|------|-----------|
| Pre-Migration Backup | | | |
| Railway Setup | | | |
| Database Migration | | | |
| Environment Config | | | |
| Domain Setup | | | |
| Validation Tests | | | |
| Performance Tests | | | |
| Final Approval | | | |

---

**Notes:**
- This checklist should be executed in order
- Mark each item as completed with ✅
- Document any issues or deviations in notes section
- Keep this checklist as deployment documentation