# 📝 Changelog

All notable changes to the Bogart Discord Bot will be documented in this file.

## 🚧 [Unreleased]

## 🎉 [2024-06-25] - Container Stability & UX Overhaul

### 🔧 Fixed - Critical Container Issues
- **sqlite3 Native Bindings**: Resolved container startup failures caused by missing sqlite3 native bindings
  - Modified Dockerfile to use `npm rebuild sqlite3` after optimized installs
  - Maintained fast build performance while ensuring runtime stability
  - Container now starts reliably with proper database connectivity

### ✨ Improved - User Experience & Interface Design  
- **Simplified Hub Command**: Streamlined overwhelming interface to focus on user needs
  - Reduced from 6 buttons to 2-3 essential actions
  - Replaced technical jargon with friendly, approachable language
  - Changed title from "Bogart's Goblin Den" to "Meet Bogart!" for better first impressions
  - Removed confusing technical metrics (engagement scores, observation periods)
  
- **Honest Admin Panel**: Transformed misleading configuration panel into helpful information
  - Removed promises of "configurable" settings that didn't exist
  - Added clear explanation of multi-guild architecture constraints
  - Focused on actionable steps admins can actually take
  - Changed button from "Admin Settings" to "Admin Info" with appropriate styling

### 🛠️ Enhanced - Error Handling & Reliability
- **Discord Interaction Timeouts**: Added robust error handling for expired interactions
  - Implemented immediate deferReply with proper error catching
  - Added graceful degradation when interactions expire
  - Eliminated cascading error messages in logs
  - Fixed deprecation warnings by using `MessageFlags.Ephemeral`

### ⚡ Optimized - Build Performance (Continued)
- **Docker Build Speed**: Maintained ~2.3 second cached builds while fixing native dependencies
- **sqlite3 Compilation**: Balanced build optimization with required native module compilation

## 📋 [Previous Releases]

### ✨ Added
- **Loneliness Prevention System**: Implemented "Long Time No See" bonus to ensure small or inactive servers are never forgotten
  - Adds +5 points per day since last visit to channel scoring
  - Guarantees that even quiet servers will eventually receive visits
  - Self-regulating system that resets bonus after each visit
  - Visible in bot decision-making logs for transparency
- Enhanced logging to display loneliness bonus values in wandering service output

### 🔄 Changed
- Updated `ChannelScore` interface to include `lonelinessBonus` field
- Modified channel scoring algorithm to integrate loneliness bonus with existing scoring system
- Enhanced wandering service logs to show loneliness bonus for better debugging

### 🔧 Technical Details
- Added `LONELINESS_BONUS_POINTS_PER_DAY` constant (5 points per day)
- Updated `scoreChannel()` method in `WanderingService` to calculate and apply loneliness bonus
- Loneliness bonus calculation: `Math.floor(daysSinceLastVisit) * LONELINESS_BONUS_POINTS_PER_DAY`
- Maintains backward compatibility with existing scoring system

### 🏢 Multi-Guild Architecture
- **Multi-Guild Support**: Complete redesign to support multiple Discord servers simultaneously
- **Intelligent Channel Discovery**: Automatic channel detection with permission validation
- **Enhanced Security**: Added permission checks, rate limiting, and NSFW filtering
- **Per-Guild Rate Limiting**: Prevents spam with 6-hour cooldowns per server
- **Safety Features**: Circuit breaker, message limits, and comprehensive error handling

### ⭐ Core Features
- **Wandering Messages**: Periodic message system with 12-hour intervals
- **Quote System**: YAML-based message configuration with channel-specific support
- **Message Cleanup**: Emergency cleanup system with privacy-focused scanning limits
- **Docker Support**: Production-ready containerization with development and production modes
- **Comprehensive Testing**: Full test coverage with Jest and proper mocking patterns

### 🏗️ Infrastructure
- **TypeScript**: Full TypeScript implementation with strict type checking
- **Dependency Injection**: Service-oriented architecture with clean separation of concerns
- **Configuration Management**: Environment-based configuration with sensible defaults
- **Logging**: Structured logging with configurable levels
- **Deployment**: Automated deployment scripts with safety features

---

*For more details about the architecture and implementation, see [ARCHITECTURE.md](ARCHITECTURE.md) and [README.md](README.md).*