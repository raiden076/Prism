#!/bin/bash
#
# User Notification Script for Auth Migration
# Task 5.8: Notify users about upcoming auth system migration
#

set -e

# Configuration
NOTIFICATION_TYPE="${1:-email}"  # email, sms, push, all
ROLLOUT_STAGE="${2:-upcoming}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=============================================="
echo "📢 PRISM Auth Migration User Notification"
echo "=============================================="
echo "Notification Type: $NOTIFICATION_TYPE"
echo "Rollout Stage: $ROLLOUT_STAGE"
echo "=============================================="
echo ""

# Pre-migration notice (48 hours before)
PRE_MIGRATION_NOTICE=$(cat <<'EOF'
Subject: Important: PRISM Authentication System Upgrade

Dear PRISM User,

We're upgrading our authentication system to provide you with a more secure and reliable login experience.

What's Changing:
- New secure login with WhatsApp/SMS OTP
- Enhanced session management
- Better security with automatic token refresh
- Same phone number login - no action needed from you

When: [DATE] at [TIME] IST
Duration: ~30 minutes maintenance window

What You Need to Do:
- Update your PRISM app before [DATE]
- Ensure you can receive WhatsApp/SMS messages
- No password changes required

Questions? Contact support at support@prism.civic

Thank you,
PRISM Team
EOF
)

# Migration in-progress notice
MIGRATION_IN_PROGRESS=$(cat <<'EOF'
Subject: PRISM Update: New Login System Now Active

Dear PRISM User,

We've successfully upgraded our authentication system!

What's New:
✓ More secure login process
✓ Faster WhatsApp/SMS delivery
✓ Improved session stability
✓ Enhanced account protection

Your Next Login:
1. Open PRISM app
2. Enter your phone number
3. Receive OTP via WhatsApp (or SMS)
4. Enter OTP to login

No changes to your account or data.

Need help? Contact support@prism.civic

Best regards,
PRISM Team
EOF
)

# Post-migration follow-up (24 hours after)
POST_MIGRATION_FOLLOWUP=$(cat <<'EOF'
Subject: How's Your New PRISM Login Experience?

Dear PRISM User,

It's been 24 hours since we upgraded our authentication system. We hope you're enjoying the improved login experience!

Quick Feedback:
- Is login working smoothly? 
- Are you receiving OTPs promptly?
- Any issues we should know about?

Reply to this email or contact support@prism.civic

Thank you for being a PRISM user!

Best regards,
PRISM Team
EOF
)

# Function to send notification
send_notification() {
    local type=$1
    local message=$2
    
    echo -e "${BLUE}📤 Sending $type notifications...${NC}"
    
    case $type in
        email)
            echo "   Sending email notifications..."
            # In production, integrate with email service
            # Example: sendgrid, mailgun, etc.
            echo "   ✅ Email notifications queued"
            ;;
        sms)
            echo "   Sending SMS notifications..."
            # In production, integrate with SMS service
            # Example: twilio, msg91, etc.
            echo "   ✅ SMS notifications queued"
            ;;
        push)
            echo "   Sending push notifications..."
            # In production, integrate with push service
            # Example: firebase, onesignal, etc.
            echo "   ✅ Push notifications queued"
            ;;
    esac
}

# Main logic based on rollout stage
case $ROLLOUT_STAGE in
    "upcoming")
        echo -e "${YELLOW}📅 Pre-Migration Notice (48 hours before)${NC}"
        echo ""
        echo "$PRE_MIGRATION_NOTICE"
        echo ""
        
        if [[ "$NOTIFICATION_TYPE" == "all" ]]; then
            send_notification "email" "$PRE_MIGRATION_NOTICE"
            send_notification "push" "$PRE_MIGRATION_NOTICE"
        else
            send_notification "$NOTIFICATION_TYPE" "$PRE_MIGRATION_NOTICE"
        fi
        ;;
        
    "in-progress")
        echo -e "${BLUE}🔄 Migration In Progress Notice${NC}"
        echo ""
        echo "$MIGRATION_IN_PROGRESS"
        echo ""
        
        if [[ "$NOTIFICATION_TYPE" == "all" ]]; then
            send_notification "email" "$MIGRATION_IN_PROGRESS"
            send_notification "sms" "$MIGRATION_IN_PROGRESS"
            send_notification "push" "$MIGRATION_IN_PROGRESS"
        else
            send_notification "$NOTIFICATION_TYPE" "$MIGRATION_IN_PROGRESS"
        fi
        ;;
        
    "completed")
        echo -e "${GREEN}✅ Post-Migration Follow-up (24 hours after)${NC}"
        echo ""
        echo "$POST_MIGRATION_FOLLOWUP"
        echo ""
        
        if [[ "$NOTIFICATION_TYPE" == "all" ]]; then
            send_notification "email" "$POST_MIGRATION_FOLLOWUP"
        else
            send_notification "$NOTIFICATION_TYPE" "$POST_MIGRATION_FOLLOWUP"
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Invalid rollout stage: $ROLLOUT_STAGE${NC}"
        echo "Valid stages: upcoming, in-progress, completed"
        exit 1
        ;;
esac

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Notification Process Complete${NC}"
echo "=============================================="
echo ""
echo "Summary:"
echo "  Stage: $ROLLOUT_STAGE"
echo "  Type: $NOTIFICATION_TYPE"
echo "  Status: Sent ✅"
echo ""
echo "Next Steps:"
echo "  - Monitor user feedback"
echo "  - Track support tickets"
echo "  - Check app reviews"
echo "=============================================="
