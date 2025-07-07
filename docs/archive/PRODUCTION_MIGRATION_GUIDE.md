# 🚀 Production Migration Guide: bogat → bogart

## Overview
The repository has been renamed from `bogat-bot-small` to `bogart-bot-small` to fix a long-standing typo. All recent development work (container fixes, UX improvements, etc.) is in the new correctly named repository.

## ⚠️ Important Information
- **Old Repository**: `https://github.com/Jhn-git/bogat-bot-small` (deprecated)
- **New Repository**: `https://github.com/Jhn-git/bogart-bot-small` (active)
- **Migration Required**: Production systems need to be updated to use the new repository
- **Downtime**: Minimal - only during container restart

## 📋 Pre-Migration Checklist
- [ ] Notify team of planned maintenance window
- [ ] Backup current `.env` file
- [ ] Ensure Docker and git are available on production server
- [ ] Have rollback plan ready (keep old repository reference)

## 🔧 Migration Steps

### Step 1: Stop Current Services
```bash
# Navigate to current deployment directory
cd /path/to/current/bogat-bot-small

# Stop running containers
docker-compose down

# Optional: Create backup of current state
sudo cp -r . ../bogat-bot-small-backup-$(date +%Y%m%d)
```

### Step 2: Update Git Remote
```bash
# Check current remote
git remote -v

# Add new repository as remote
git remote add new-origin https://github.com/Jhn-git/bogart-bot-small.git

# Fetch from new repository
git fetch new-origin

# Switch to new repository
git remote remove origin
git remote rename new-origin origin

# Set tracking for develop branch
git checkout develop
git branch -u origin/develop develop
```

### Step 3: Pull Latest Changes
```bash
# Pull all the latest improvements
git pull origin develop

# Verify you have the latest changes
git log --oneline -5
# Should show recent commits including:
# - Container startup fixes
# - Hub command improvements
# - Package name correction
```

### Step 4: Verify Configuration
```bash
# Check package.json has correct name
grep '"name"' package.json
# Should show: "name": "bogart-bot-small"

# Verify .env file is still correct
ls -la .env
# Make sure your production .env file is still there

# Check for any new environment variables in .env.example
diff .env .env.example || echo "Check if new variables needed"
```

### Step 5: Rebuild and Restart
```bash
# Clean build (ensures all changes are included)
docker-compose build --no-cache

# Start services
docker-compose up -d

# Verify container is running
docker-compose ps
```

### Step 6: Verification
```bash
# Check container logs
docker-compose logs -f --tail=20

# Verify bot is online in Discord
# Look for log messages like:
# - "Bogart Discord Bot started successfully!"
# - "Logged in as [BotName]"
# - "Connected to X servers"

# Test hub command in Discord
# Run /hub command to verify new simplified interface works
```

## ✅ Success Indicators
- [ ] Container starts without sqlite3 binding errors
- [ ] Bot logs show successful login and guild connections
- [ ] `/hub` command shows new simplified interface
- [ ] No deprecation warnings in logs
- [ ] Bot responds normally to interactions

## 🔄 Rollback Procedure (If Needed)
If issues occur, you can quickly rollback:

```bash
# Stop new version
docker-compose down

# Restore backup
cd ../bogat-bot-small-backup-$(date +%Y%m%d)

# Start old version
docker-compose up -d

# Report issues to development team
```

## 📊 What Changed in New Version

### 🔧 Critical Fixes
- **Container Startup**: Fixed sqlite3 native bindings issue that caused startup failures
- **Interaction Timeouts**: Improved error handling for Discord interaction timeouts
- **Build Optimization**: Maintained fast builds while fixing native dependencies

### ✨ User Experience Improvements
- **Simplified Hub**: Reduced from 6 buttons to 3, removed overwhelming technical details
- **Honest Admin Panel**: Removed misleading "configurable" claims, added helpful explanations
- **Better Error Handling**: Graceful degradation when interactions expire

### 📦 Package Updates
- **Name Correction**: Package name fixed from "bogat-bot-small" to "bogart-bot-small"
- **Dependencies**: All dependencies updated and verified

## 🆘 Support
If you encounter any issues during migration:

1. **Check logs first**: `docker-compose logs -f`
2. **Common issues**:
   - sqlite3 errors → Rebuild with `--no-cache`
   - Permission errors → Check file ownership
   - Network errors → Verify git repository access

3. **Contact development team** with:
   - Error messages from logs
   - Steps you completed before the error
   - Current git commit hash: `git rev-parse HEAD`

## 📝 Post-Migration Notes
- Update any deployment scripts to reference new repository URL
- Update monitoring/alerting to use new repository name
- Consider cleaning up old "bogat" references in documentation
- The bot will continue to work with existing Discord application (no Discord Developer Portal changes needed)

---

**Estimated Migration Time**: 10-15 minutes  
**Expected Downtime**: 2-5 minutes (during container restart)  
**Risk Level**: Low (rollback available)

*This migration fixes critical stability issues and improves user experience significantly.*