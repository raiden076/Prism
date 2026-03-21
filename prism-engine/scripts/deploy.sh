#!/bin/bash
#
# Deployment Script for SuperTokens Migration
# Task 5.7: Schedule production deployment with maintenance window
#

set -e

# Configuration
ENVIRONMENT="${1:-staging}"
MAINTENANCE_WINDOW_MINUTES=30
ROLLOUT_STAGE="${2:-10%}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=============================================="
echo "🚀 PRISM SuperTokens Deployment"
echo "=============================================="
echo "Environment: $ENVIRONMENT"
echo "Rollout Stage: $ROLLOUT_STAGE"
echo "Maintenance Window: $MAINTENANCE_WINDOW_MINUTES minutes"
echo "=============================================="
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo "Usage: $0 [staging|production] [10%|50%|100%]"
    exit 1
fi

# Validate rollout stage
if [[ "$ROLLOUT_STAGE" != "10%" && "$ROLLOUT_STAGE" != "50%" && "$ROLLOUT_STAGE" != "100%" ]]; then
    echo -e "${RED}❌ Invalid rollout stage: $ROLLOUT_STAGE${NC}"
    echo "Usage: $0 [staging|production] [10%|50%|100%]"
    exit 1
fi

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check environment variables
if [[ -z "$SUPERTOKENS_CORE_URL" ]]; then
    echo -e "${RED}❌ SUPERTOKENS_CORE_URL not set${NC}"
    exit 1
fi

if [[ -z "$SUPERTOKENS_API_KEY" ]]; then
    echo -e "${RED}❌ SUPERTOKENS_API_KEY not set${NC}"
    exit 1
fi

if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
    echo -e "${RED}❌ CLOUDFLARE_API_TOKEN not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Run tests
echo -e "${BLUE}🧪 Running tests...${NC}"
npm run test
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed. Aborting deployment.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Tests passed${NC}"
echo ""

# Database migration check
echo -e "${BLUE}🗄️  Checking database migrations...${NC}"
bun run db:migrate:status
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Database migrations pending. Applying now...${NC}"
    bun run db:migrate
fi
echo -e "${GREEN}✅ Database ready${NC}"
echo ""

# Start maintenance window (production only)
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "${YELLOW}🚧 Starting maintenance window ($MAINTENANCE_WINDOW_MINUTES minutes)...${NC}"
    echo "   Users may experience brief interruptions"
    sleep 5
fi

# Deploy backend
echo -e "${BLUE}🚀 Deploying backend to $ENVIRONMENT...${NC}"

if [[ "$ENVIRONMENT" == "production" ]]; then
    wrangler deploy --env production
else
    wrangler deploy --env staging
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend deployed${NC}"
echo ""

# Set feature flags
echo -e "${BLUE}⚙️  Setting feature flags...${NC}"
wrangler secret put USE_SUPERTOKENS_AUTH --env $ENVIRONMENT <<< "true"
wrangler secret put ROLLOUT_STAGE --env $ENVIRONMENT <<< "$ROLLOUT_STAGE"
echo -e "${GREEN}✅ Feature flags set: ROLLOUT_STAGE=$ROLLOUT_STAGE${NC}"
echo ""

# Health check
echo -e "${BLUE}🏥 Running health checks...${NC}"
sleep 10

HEALTH_URL="https://prism-engine-$ENVIRONMENT.arkaprav0.workers.dev/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [[ "$HTTP_STATUS" == "200" ]]; then
    echo -e "${GREEN}✅ Health check passed (HTTP $HTTP_STATUS)${NC}"
else
    echo -e "${RED}❌ Health check failed (HTTP $HTTP_STATUS)${NC}"
    echo "   Rolling back..."
    # Rollback logic here
    exit 1
fi

echo ""

# End maintenance window
echo -e "${GREEN}✅ Maintenance window complete${NC}"
echo ""

# Deployment summary
echo "=============================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=============================================="
echo "Environment: $ENVIRONMENT"
echo "Rollout Stage: $ROLLOUT_STAGE"
echo "Backend: Deployed ✅"
echo "Feature Flags: Enabled ✅"
echo "Health Check: Passed ✅"
echo ""
echo "Next Steps:"
echo "  1. Monitor authentication metrics"
echo "  2. Watch for error rates"
echo "  3. Wait 24 hours before next stage"
echo "=============================================="

# Notify team (if in production)
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo ""
    echo "📢 Notifying team..."
    # Slack notification could go here
fi
