# 17TRACK API Reference

This document provides a quick reference for the 17TRACK API endpoints and data formats used in our integration.

## API Base URL

```
https://api.17track.net/track/v2.2
```

## Authentication

All API requests require the `17token` header with your API key:

```
17token: your-api-key-here
```

## Main Endpoints

### Register Tracking Number

**Endpoint**: `/register`

**Method**: `POST`

**Request Format**:
```json
[
  {
    "number": "RR123456789CN",
    "carrier": 3011,             // Optional - uses auto-detection if omitted
    "auto_detection": true,      // Enable carrier auto-detection
    "order_no": "202340984938",  // Your internal order number
    "order_time": "2023/1/1",    // Order date
    "tag": "MyOrderId"           // Optional custom tag
  }
]
```

**Response Format**:
```json
{
  "code": 0,
  "data": {
    "accepted": [
      {
        "origin": 1,
        "number": "RR123456789CN",
        "carrier": 3011
      }
    ],
    "rejected": []
  }
}
```

### Get Tracking Info

**Endpoint**: `/getRealTimeTrackInfo`

**Method**: `POST`

**Request Format**:
```json
[
  {
    "number": "RR123456789CN",
    "carrier": 3011,           // Optional
    "auto_detection": true,    // Enable carrier auto-detection
    "cacheLevel": 1            // 1 = real-time fetch (costs 10 quota), 0 = cached data (costs 1 quota)
  }
]
```

**Response Contains**:
- `latest_status`: Current shipping status
- `latest_event`: Most recent tracking event
- `time_metrics`: Transit time and delivery estimates
- `tracking.providers[].events`: All tracking events

### Stop Tracking

**Endpoint**: `/stoptrack`

**Method**: `POST`

**Request Format**:
```json
[
  {
    "number": "RR123456789CN",
    "carrier": 3011
  }
]
```

## Status Codes

### Main Status Codes

- `InfoReceived`: Carrier has shipping info, package not picked up yet
- `InTransit`: Package is in transit
- `OutForDelivery`: Package is out for delivery
- `Delivered`: Package has been delivered
- `AvailableForPickup`: Package available for pickup
- `Exception`: Issues with delivery (return, customs, etc.)
- `Expired`: Package in transit for a long time without updates
- `NotFound`: Tracking number not recognized

### Sub-Status Examples

- `InTransit_PickedUp`: Package picked up by carrier
- `InTransit_Departure`: Package has left origin country
- `InTransit_Arrival`: Package arrived at destination country
- `InTransit_CustomsProcessing`: Package in customs clearance
- `Exception_Returning`: Package is being returned to sender

## Webhook Integration

### Webhook Events

The webhook sends events to your endpoint with these event types:

- `TRACKING_UPDATED`: New tracking information available
- `TRACKING_STOPPED`: Tracking has stopped (delivered/expired)

### Webhook Payload Example (TRACKING_UPDATED)

```json
{
  "event": "TRACKING_UPDATED",
  "data": {
    "number": "RR123456789CN",
    "carrier": 3011,
    "track_info": {
      "latest_status": {
        "status": "InTransit",
        "sub_status": "InTransit_Other"
      },
      "latest_event": {
        "time_utc": "2022-03-03T02:43:24Z",
        "description": "Package in transit",
        "location": "SHENZHEN, CN"
      },
      "tracking": {
        "providers": [
          {
            "events": [
              {
                "time_utc": "2022-03-03T02:43:24Z",
                "description": "Package in transit",
                "location": "SHENZHEN, CN"
              }
            ]
          }
        ]
      }
    }
  }
}
```

## Carrier Codes

Common carrier codes used in our system:

- USPS: 21051
- FedEx: 100003
- UPS: 100001
- DHL: 7041
- China Post: 3011

For a complete list, see: https://res.17track.net/asset/carrier/info/apicarrier.all.json

## Quota Usage

- Registration: 1 quota per tracking number
- Tracking (cached): 1 quota
- Tracking (real-time): 10 quota
- Free plan includes 100 quota per month 