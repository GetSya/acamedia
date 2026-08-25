// ─────────────────────────────────────────────
// Custom Payment Gateway Service (arasyarafi.xyz)
// ─────────────────────────────────────────────
const axios = require('axios');
const logger = require('../utils/logger');

const PAY_BASE_URL = 'https://store.arasyarafi.xyz/pay';
const STATUS_BASE_URL = 'https://store.arasyarafi.xyz/api/payment/status';

/**
 * Generate Payment Link for an Order / Donation
 * @param {string} orderId
 * @param {number} amount
 * @returns {string} Payment URL
 */
function getPaymentUrl(orderId, amount) {
  const finalAmount = Math.round(Number(amount));
  return `${PAY_BASE_URL}?pay=${finalAmount}&order_id=${encodeURIComponent(orderId)}`;
}

/**
 * Check payment status via custom API (https://store.arasyarafi.xyz/api/payment/status?order_id=...)
 * Status 1 = Paid / Success
 * Status 0 = Not Paid / Failed
 * @param {string} orderId
 * @returns {Promise<{isPaid: boolean, status: number, raw: object}>}
 */
async function checkPaymentStatus(orderId) {
  try {
    const url = `${STATUS_BASE_URL}?order_id=${encodeURIComponent(orderId)}`;
    logger.info(`[ArasyarafiPayment] Checking status for ${orderId}: ${url}`);

    const res = await axios.get(url, { validateStatus: () => true, timeout: 10000 });
    const data = res.data || {};

    const statusVal = Number(data.status);
    const isPaid = statusVal === 1;

    logger.info(`[ArasyarafiPayment] Status for ${orderId}: ${statusVal} (isPaid: ${isPaid})`);

    return {
      isPaid,
      status: isPaid ? 1 : 0,
      raw: data,
    };
  } catch (err) {
    logger.error(`[ArasyarafiPayment] Error checking status for ${orderId}: ${err.message}`);
    return {
      isPaid: false,
      status: 0,
      raw: { error: err.message },
    };
  }
}

module.exports = {
  getPaymentUrl,
  checkPaymentStatus,
};
