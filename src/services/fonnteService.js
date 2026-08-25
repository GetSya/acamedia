// -------------------------------------------------
// Fonnte WhatsApp Service
// Kirim notifikasi WA via fonnte.com
// -------------------------------------------------
const fetch = require('node-fetch');
const logger = require('../utils/logger');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'BXSC8yUoZUrBgyd8QFRm';
const FONNTE_URL   = 'https://api.fonnte.com/send';

/**
 * Send WhatsApp message via Fonnte
 * @param {string} target - WA number e.g. "628xxx" or multiple with comma
 * @param {string} message - Text message
 * @param {string} [url] - Optional image URL
 * @returns {Promise<object>}
 */
async function sendWA(target, message, url = null) {
  try {
    const body = {
      target:  target,
      message: message,
    };
    if (url) body.url = url;

    const response = await fetch(FONNTE_URL, {
      method:  'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
        'Content-Type':  'application/json',
      },
      body:    JSON.stringify(body),
      timeout: 10000,
    });

    const data = await response.json().catch(() => ({}));
    if (!data.status) {
      logger.warn('[Fonnte] WA send failed: ' + JSON.stringify(data));
    } else {
      logger.info('[Fonnte] WA sent to ' + target);
    }
    return data;
  } catch (err) {
    logger.error('[Fonnte] Error sending WA: ' + err.message);
    return { status: false, error: err.message };
  }
}

module.exports = { sendWA, FONNTE_TOKEN };
