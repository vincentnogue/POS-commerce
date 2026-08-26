# Marketplace Access Control

**Status:** ✅ **IMPLEMENTED & PRODUCTION READY**  
**Date:** August 26, 2026  
**Type:** Plan-based + Role-based access control  

---

## 🎯 Overview

Marketplace access is controlled by two factors:

1. **Plan Tier** - Determines number of integrations and available categories
2. **User Role** - Determines what actions users can perform

Super admins get **full unrestricted access** to all marketplace features regardless of plan.

---

## 📊 Plan Limits

### Starter ($99/mo)
```
Max Integrations: 5
Categories: payments, shipping
Custom Integration: ❌
API Access: ❌
Webhook Test: ❌
Production Mode: ❌
Rate Limit: 100 req/min
```

### Professional ($299/mo)
```
Max Integrations: 10
Categories: payments, shipping, accounting, ecommerce, notifications
Custom Integration: ✅
API Access: ✅
Webhook Test: ✅
Production Mode: ✅
Rate Limit: 500 req/min
```

### Enterprise ($999/mo)
```
Max Integrations: Unlimited
Categories: All (payments, shipping, accounting, ecommerce, notifications)
Custom Integration: ✅
API Access: ✅
Webhook Test: ✅
Production Mode: ✅
Rate Limit: 1000 req/min
```

### Custom (Contact sales)
```
Max Integrations: Unlimited
Categories: All
Custom Integration: ✅
API Access: ✅
Webhook Test: ✅
Production Mode: ✅
Rate Limit: 5000 req/min
```

---

## 👥 Role Permissions

| Action | Super Admin | Admin | Manager | Staff | Viewer |
|--------|:----------:|:-----:|:-------:|:-----:|:------:|
| Browse Marketplace | ✅ | ✅ | ✅ | ✅ | ✅ |
| Connect Integration | ✅ | ✅ | ✅ | ❌ | ❌ |
| Disconnect Integration | ✅ | ✅ | ❌ | ❌ | ❌ |
| Test Connection | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Credentials | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Connection | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Sync Logs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Configure Webhooks | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🔐 Super Admin Access

**Super admins bypass all restrictions:**

✅ Can connect unlimited integrations (regardless of plan)  
✅ Can connect any category (regardless of plan)  
✅ Can access all marketplace features  
✅ Can configure webhooks  
✅ Can view all credentials  
✅ Can delete any connection  
✅ Bypasses rate limits (5000 req/min)  

---

## 🔄 How It Works

### 1. On Marketplace Page Load

When a user opens the Marketplace:

```typescript
// MarketplacePage.tsx
useEffect(() => {
  checkMarketplaceAccess();
}, [user?.id, tenant?.id, plan]);

async function checkMarketplaceAccess() {
  const response = await fetch(
    '/functions/v1/marketplace-access-check',
    {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: tenant.id,
        user_id: user.id,
        action: 'connect',
      }),
    }
  );
  
  const result = await response.json();
  setUserCanConnect(result.allowed);
  setIntegrationLimit(result.plan_limits.max_integrations);
}
```

### 2. Check Runs Function

The `marketplace-access-check` edge function:

1. Gets user's role
2. Checks if super_admin → **grant full access**
3. Gets tenant's plan
4. Gets role permissions
5. Checks specific action permission
6. If connecting → count active integrations vs limit
7. Return access decision + plan limits

### 3. UI Updates

Based on response:

```typescript
// If super_admin
<button>Connect</button> // Always enabled

// If regular user
{userCanConnect && activeIntegrations < integrationLimit && (
  <button>Connect Integration</button>
)}

// Show plan info
<div>
  {activeIntegrations} / {integrationLimit} integrations used
</div>
```

---

## 📋 Database Tables

### marketplace_plan_limits
```sql
id              uuid
plan_id         text (starter, professional, enterprise, custom)
plan_name       text
max_integrations integer
allowed_categories text[]
allows_custom_integration boolean
allows_api_access boolean
allows_webhook_test boolean
allows_production_mode boolean
rate_limit_per_minute integer
created_at      timestamp
updated_at      timestamp
```

### marketplace_role_permissions
```sql
id                          uuid
role                        text (super_admin, admin, manager, staff, viewer)
can_browse_marketplace      boolean
can_connect_integration     boolean
can_disconnect_integration  boolean
can_test_connection         boolean
can_view_credentials        boolean
can_delete_connection       boolean
can_view_sync_logs          boolean
can_configure_webhooks      boolean
created_at                  timestamp
```

### user_marketplace_access
```sql
id                  uuid
tenant_id           uuid
user_id             uuid
plan_id             text
role                text
active_integrations integer
last_accessed_at    timestamp
created_at          timestamp
updated_at          timestamp
```

---

## 🚀 Edge Functions

### marketplace-access-check

**Endpoint:** `/functions/v1/marketplace-access-check`

**Request:**
```json
{
  "tenant_id": "uuid",
  "user_id": "uuid",
  "action": "connect" | "disconnect" | "test" | "view_credentials" | "delete" | "view_logs" | "webhooks" | "browse"
}
```

**Response (Allowed):**
```json
{
  "allowed": true,
  "reason": "access_granted",
  "user_role": "super_admin",
  "plan": "enterprise",
  "plan_limits": {
    "max_integrations": 999,
    "allowed_categories": ["payments", "shipping", "accounting", "ecommerce", "notifications"],
    "allows_custom_integration": true,
    "allows_api_access": true,
    "allows_webhook_test": true,
    "allows_production_mode": true
  }
}
```

**Response (Denied - Plan Limit):**
```json
{
  "allowed": false,
  "reason": "integration_limit_reached",
  "current_count": 5,
  "max_allowed": 5,
  "plan": "starter"
}
```

**Response (Denied - Permission):**
```json
{
  "allowed": false,
  "reason": "insufficient_permissions",
  "user_role": "staff",
  "plan": "professional",
  "required_action": "connect"
}
```

---

## ✅ Implementation Details

### For Super Admin
```typescript
// Super admins always see:
✅ Unlimited integrations in marketplace
✅ All providers available
✅ All features enabled
✅ No rate limits
✅ Can test webhooks
✅ Can configure production mode
```

### For Plan Users
```typescript
// Show integration limit
<div>
  {activeIntegrations} / {integrationLimit} integrations
  {integrationLimit && activeIntegrations >= integrationLimit && (
    <p>Upgrade to add more integrations</p>
  )}
</div>

// Disable connect if limit reached
<button 
  disabled={activeIntegrations >= integrationLimit}
>
  Connect Integration
</button>
```

### For Role-Based Users
```typescript
// Manager can test but not delete
if (rolePerms.can_test_connection) {
  showTestButton();
}
if (!rolePerms.can_delete_connection) {
  hideDeleteButton();
}
```

---

## 🔒 Security

✅ **Multi-tenant isolation** - Users only see their tenant's data  
✅ **Role enforcement** - Cannot bypass role checks  
✅ **Plan enforcement** - Cannot exceed integration limit  
✅ **Credential encryption** - Credentials stored encrypted  
✅ **Audit logging** - All access tracked  

---

## 📈 Future Enhancements

- [ ] Usage metrics per integration
- [ ] Integration cost tracking
- [ ] Auto-disable over-quota integrations
- [ ] Plan upgrade suggestions
- [ ] Integration migration on plan downgrade

---

## 🎯 Summary

| Feature | Status |
|---------|--------|
| **Plan Limits** | ✅ Implemented |
| **Role Permissions** | ✅ Implemented |
| **Super Admin Full Access** | ✅ Implemented |
| **Edge Function Check** | ✅ Implemented |
| **Database Tables** | ✅ Implemented |
| **UI Integration** | ✅ Implemented |
| **Production Ready** | ✅ YES |

---

**Status:** ✅ Ready for production  
**All Super Admins:** Get unlimited marketplace access  
**All Users:** Respect plan limits and role permissions  
**No Code Broken:** Original landing page restored  

