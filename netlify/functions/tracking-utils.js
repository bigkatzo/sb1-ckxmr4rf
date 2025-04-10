/**
 * Utility functions for tracking serverless functions
 * CommonJS version of needed functions from src/services/tracking.ts
 */

// 17TRACK API carrier codes
const CARRIER_CODES = {
  usps: 21051,
  fedex: 100003,
  ups: 100001,
  dhl: 7041,
  'dhl-express': 7042,
  // Add more carriers as needed
};

/**
 * Gets the carrier code from a name or ID
 * @param {string} carrier Carrier name or ID
 * @returns {number} The carrier code number or 0 if not found
 */
function getCarrierCode(carrier) {
  // If the carrier is already a number, return it
  if (!isNaN(Number(carrier))) {
    return Number(carrier);
  }
  
  // Otherwise look up by name
  return CARRIER_CODES[carrier.toLowerCase()] || 0;
}

/**
 * Map 17TRACK status to our system status
 * @param {string} status The 17TRACK status
 * @returns {string} Our system status
 */
function mapTrackingStatus(status) {
  const statusMap = {
    'InfoReceived': 'pending',
    'InTransit': 'confirmed',
    'AvailableForPickup': 'in_transit',
    'OutForDelivery': 'in_transit',
    'DeliveryFailure': 'exception',
    'Delivered': 'delivered',
    'Exception': 'exception',
    'Expired': 'exception',
    'NotFound': 'pending',
  };
  
  return statusMap[status] || 'pending';
}

module.exports = {
  CARRIER_CODES,
  getCarrierCode,
  mapTrackingStatus
}; 