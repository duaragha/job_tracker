# Railway Deployment Setup Guide

This guide provides step-by-step instructions for deploying the Job Tracker application to Railway.

## Prerequisites

- Railway account (create at [railway.app](https://railway.app))
- Railway CLI installed: `npm install -g @railway/cli`
- Access to Supabase project
- Git repository access

## Quick Start

### 1. Prepare for Deployment

```bash
# Run the preparation script
npm run deploy:prepare

# This will:
# - Create backups
# - Set up deployment branch
# - Verify configuration
# - Test build process
```

### 2. Railway CLI Setup

```bash
# Login to Railway
railway login

# Verify login
railway whoami
```

### 3. Create Railway Project

```bash
# Initialize Railway project
railway init

# Follow prompts:
# - Select "Deploy from GitHub repo"
# - Choose your repository
# - Select "railway-deployment" branch
# - Name project "job-tracker-prod"
```

### 4. Configure Environment Variables

In Railway Dashboard, add these environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
NODE_ENV=production
```

### 5. Deploy

```bash
# Deploy to Railway
railway up

# Monitor deployment
railway logs
```

## Detailed Configuration

### Railway Configuration (railway.toml)

The project includes a pre-configured `railway.toml` file with:
- Nixpacks builder
- Health checks
- Resource allocation
- Auto-deployment settings

### Build Configuration

- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm run preview`
- **Health Check**: `/health`
- **Port**: Automatically assigned by Railway

### Environment Variables

#### Required Variables
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

#### Automatic Variables (Set by Railway)
- `PORT`: Application port
- `NODE_ENV`: Set to "production"
- `RAILWAY_ENVIRONMENT`: Railway environment name

### Domain Configuration

1. **Default Domain**: Your app will be available at `[project-name].railway.app`
2. **Custom Domain**: Configure in Railway Dashboard > Settings > Domains

## Supabase Configuration

### Update CORS Settings

In Supabase Dashboard:
1. Go to Authentication > Settings
2. Add Railway domain to "Site URL"
3. Add to "Additional Redirect URLs" if using auth

### Database Considerations

- Keep existing Supabase project (recommended)
- Or migrate to new Supabase project for production
- Update environment variables accordingly

## Testing Deployment

### Health Checks

- **Health endpoint**: `https://your-app.railway.app/health`
- **JSON health**: `https://your-app.railway.app/health.json`

### Functional Testing

1. **Application Load**: Verify homepage loads
2. **Database**: Test job creation/editing
3. **Features**: Test all major functionality
4. **Performance**: Check load times

### Performance Testing

```bash
# Run performance benchmarks locally
npm run test:benchmark
npm run test:stress

# Monitor Railway metrics in dashboard
```

## Monitoring and Maintenance

### Railway Dashboard

Monitor:
- Deployment logs
- Resource usage
- Error rates
- Performance metrics

### Alerts Setup

Configure alerts for:
- Application errors
- High resource usage
- Deployment failures
- Health check failures

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify package.json scripts
   - Review build logs

2. **Environment Variables**
   - Ensure all required variables are set
   - Check variable names (case-sensitive)
   - Verify Supabase credentials

3. **Database Connection**
   - Verify Supabase URL and key
   - Check CORS settings
   - Test database connectivity

### Debug Commands

```bash
# View deployment logs
railway logs

# Check service status
railway status

# Access service shell
railway shell

# View environment variables
railway variables
```

## Rollback Procedures

### Quick Rollback

1. **Revert to Previous Deployment**
   ```bash
   railway rollback
   ```

2. **Deploy Previous Git Commit**
   ```bash
   git checkout [previous-commit]
   railway up
   ```

### Full Rollback

1. **Switch to Main Branch**
   ```bash
   git checkout main
   railway up
   ```

2. **Restore Environment**
   - Use backup files created by `deploy:prepare`
   - Restore from `backup/env-backup-[timestamp]/`

3. **Database Rollback** (if needed)
   - Restore Supabase backup
   - Update environment variables

## Best Practices

### Security

- Never commit environment files with real credentials
- Use Railway environment variables for secrets
- Enable Railway's built-in security features
- Keep dependencies updated

### Performance

- Monitor bundle sizes
- Use Railway metrics for optimization
- Implement proper caching headers
- Optimize database queries

### Maintenance

- Regular dependency updates
- Monitor error rates
- Performance benchmarking
- Backup procedures

## Support Resources

- **Railway Documentation**: [docs.railway.app](https://docs.railway.app)
- **Railway Support**: support@railway.app
- **Supabase Support**: support@supabase.com
- **Project Repository Issues**: [Your GitHub Issues]

## Deployment Checklist

Use this checklist for each deployment:

- [ ] Run `npm run deploy:prepare`
- [ ] Review changes and test locally
- [ ] Push deployment branch
- [ ] Configure Railway environment variables
- [ ] Deploy via Railway CLI or dashboard
- [ ] Test application functionality
- [ ] Monitor for errors
- [ ] Update documentation if needed

---

*This guide is part of the Railway deployment configuration created for the Job Tracker application.*