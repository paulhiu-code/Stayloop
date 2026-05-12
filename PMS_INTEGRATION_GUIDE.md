# StayLoop PMS Integration Guide

## Overview

StayLoop integrates with major Property Management Systems (PMS) to automatically sync properties, bookings, and availability. This guide covers setup and usage for OwnerRez and Guesty.

## Supported PMS Systems

### 1. OwnerRez
- **Property Sync**: Automatically import properties from OwnerRez
- **Booking Sync**: Two-way booking synchronization
- **Calendar Sync**: Real-time availability updates
- **Webhooks**: Instant notifications for changes

### 2. Guesty
- **Listing Sync**: Import all your Guesty listings
- **Reservation Sync**: Keep bookings in sync across platforms
- **Calendar Management**: Automated availability updates
- **Multi-channel**: Supports Airbnb, Booking.com, and more

---

## Database Schema

The PMS integration uses these tables:

### `pms_connections`
Stores PMS authentication and connection details:
- `id`: Unique connection ID
- `user_id`: StayLoop user ID
- `pms_provider`: 'ownerrez' or 'guesty'
- `oauth_access_token`: OAuth access token
- `oauth_refresh_token`: OAuth refresh token
- `last_sync_at`: Last successful sync timestamp
- `sync_status`: Current sync status

### `pms_property_mappings`
Maps PMS properties to StayLoop properties:
- `pms_connection_id`: Reference to connection
- `stayloop_property_id`: Local property ID
- `pms_property_id`: External property ID
- `sync_direction`: 'to_pms', 'from_pms', or 'bidirectional'
- `auto_sync_enabled`: Enable/disable auto-sync

### `pms_sync_logs`
Tracks all sync operations:
- `sync_type`: 'property', 'booking', 'availability', etc.
- `status`: 'started', 'completed', 'failed'
- `records_processed`: Total records synced
- `error_details`: Error information if failed

### `pms_webhook_events`
Stores incoming webhook events:
- `event_type`: Type of webhook event
- `event_data`: Full webhook payload
- `processed`: Whether event was processed

---

## Setup Instructions

### OwnerRez Setup

1. **Get API Credentials**
   - Go to https://www.ownerrez.com
   - Navigate to Settings → Developer/API
   - Contact partnerhelp@ownerrez.com to create an OAuth app
   - Note your Client ID and Client Secret

2. **Configure OAuth**
   - Set redirect URI to: `https://your-domain.com/api/auth/ownerrez/callback`
   - Request scopes: `read_properties`, `read_bookings`, `read_calendar`

3. **Set Up Webhooks**
   - Webhook URL: `https://your-supabase-url/functions/v1/pms-webhook-receiver?provider=ownerrez&connection_id={CONNECTION_ID}`
   - Events: `booking.created`, `booking.updated`, `property.updated`
   - Authentication: Use the User/Password from your OAuth app

4. **Connect in StayLoop**
   - Go to Dashboard → PMS Integrations
   - Click "Add Connection"
   - Select OwnerRez
   - Complete OAuth flow
   - Start syncing!

### Guesty Setup

1. **Get API Credentials**
   - Go to https://app.guesty.com
   - Navigate to Settings → API Access
   - Generate an API key or set up OAuth
   - Copy your API key

2. **Configure Integration**
   - In Guesty dashboard, enable API access
   - Set permissions for listings, reservations, and calendar

3. **Set Up Webhooks** (Optional)
   - Webhook URL: `https://your-supabase-url/functions/v1/pms-webhook-receiver?provider=guesty&connection_id={CONNECTION_ID}`
   - Subscribe to: `reservation.created`, `reservation.updated`, `listing.updated`

4. **Connect in StayLoop**
   - Go to Dashboard → PMS Integrations
   - Click "Add Connection"
   - Select Guesty
   - Enter your API key
   - Start syncing!

---

## Edge Functions

### 1. `pms-ownerrez-sync`
Handles all OwnerRez synchronization:
- Endpoint: `/functions/v1/pms-ownerrez-sync`
- Actions: `sync_properties`, `sync_bookings`, `sync_availability`, `webhook`

**Example Request:**
```json
{
  "action": "sync_properties",
  "pmsConnectionId": "uuid-here"
}
```

### 2. `pms-guesty-sync`
Handles all Guesty synchronization:
- Endpoint: `/functions/v1/pms-guesty-sync`
- Actions: `sync_properties`, `sync_bookings`, `sync_availability`, `webhook`

**Example Request:**
```json
{
  "action": "sync_bookings",
  "pmsConnectionId": "uuid-here",
  "listingId": "guesty-listing-id"
}
```

### 3. `pms-webhook-receiver`
Receives webhooks from PMS providers:
- Endpoint: `/functions/v1/pms-webhook-receiver?provider={provider}&connection_id={id}`
- Validates connection and stores event
- Triggers appropriate sync function

---

## Usage

### Manual Sync

```typescript
import { syncPMSProperties, syncPMSBookings } from './lib/pms';

// Sync properties
await syncPMSProperties(connectionId);

// Sync bookings
await syncPMSBookings(connectionId);

// Sync availability for specific property
await syncPMSAvailability(connectionId, propertyId);
```

### Get Connection Status

```typescript
import { getPMSConnections, getSyncLogs } from './lib/pms';

// Get all connections
const connections = await getPMSConnections();

// Get sync history
const logs = await getSyncLogs(connectionId);
```

### Property Mapping

Properties are automatically mapped during first sync. To manually map:

```sql
INSERT INTO pms_property_mappings (
  pms_connection_id,
  stayloop_property_id,
  pms_property_id,
  sync_direction,
  auto_sync_enabled
) VALUES (
  'connection-uuid',
  'stayloop-property-uuid',
  'external-property-id',
  'bidirectional',
  true
);
```

---

## Sync Behavior

### Property Sync
- **First Sync**: Creates new StayLoop properties for all PMS properties
- **Subsequent Syncs**: Updates existing properties
- **Fields Synced**: Title, description, address, bedrooms, bathrooms, guests, price, amenities, images

### Booking Sync
- **From PMS**: Creates bookings in StayLoop
- **To PMS**: (Future feature) Push StayLoop bookings to PMS
- **Conflict Resolution**: PMS data takes precedence

### Availability Sync
- **Updates**: Syncs 90 days ahead
- **Frequency**: On-demand or webhook-triggered
- **Blocked Dates**: Automatically marked unavailable

---

## Troubleshooting

### Sync Failures

Check sync logs in Dashboard → PMS Integrations. Common issues:

1. **Authentication Failed**
   - Token may be expired
   - Re-authenticate the connection

2. **Property Not Found**
   - Property may have been deleted in PMS
   - Check property mappings

3. **Rate Limiting**
   - OwnerRez: 100 requests per minute
   - Guesty: 60 requests per minute
   - Sync will retry automatically

### Webhook Issues

1. **Not Receiving Webhooks**
   - Verify webhook URL is correct
   - Check webhook authentication
   - Review `pms_webhook_events` table

2. **Duplicate Events**
   - Webhooks may be sent multiple times
   - System deduplicates based on event ID

---

## Security

- OAuth tokens stored encrypted in database
- Webhook endpoints validate connection ownership
- RLS policies prevent unauthorized access
- Service role key only used in Edge Functions

---

## API Rate Limits

### OwnerRez
- 100 requests per minute
- Exponential backoff on failures
- Up to 10 retry attempts

### Guesty
- 60 requests per minute (1 per second)
- Rate limit headers respected
- Automatic throttling

---

## Future Enhancements

1. **Two-way Booking Sync**: Push StayLoop bookings to PMS
2. **Price Management**: Sync dynamic pricing
3. **Additional PMS**: Hostaway, Lodgify, Hostfully
4. **Bulk Operations**: Sync multiple properties at once
5. **Conflict Resolution**: Handle booking conflicts intelligently

---

## Support

For PMS integration support:
- OwnerRez: partnerhelp@ownerrez.com
- Guesty: Check https://open-api-docs.guesty.com/
- StayLoop: support@stayloop.com

---

## Testing

To test the integration:

1. Create test properties in your PMS
2. Connect to StayLoop
3. Trigger manual sync
4. Verify properties appear
5. Create test booking in PMS
6. Verify booking syncs to StayLoop

---

## Deployment Checklist

- [ ] Database tables created
- [ ] Edge Functions deployed
- [ ] Webhook URLs configured in PMS
- [ ] OAuth apps created and approved
- [ ] Environment variables set
- [ ] Test sync with sample data
- [ ] Monitor sync logs for errors
- [ ] Set up automated sync schedule

---

*Last updated: October 2025*
