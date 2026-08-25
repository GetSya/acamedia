// ─────────────────────────────────────────────
// Donation Service
// Pakasir Payment Integration & Donation Management
// ─────────────────────────────────────────────
const database = require('../database');
const pakasirService = require('./pakasirService');
const { generateId } = require('../utils/id');
const logger = require('../utils/logger');

/**
 * Generate Pakasir QRIS for Donation
 * @param {object} param0 { nominal, customerName, telegramId }
 * @returns {Promise<object>}
 */
async function generateDonationQris({ nominal, customerName = 'Donatur Telegram', telegramId }) {
  logger.info(`Generating Pakasir QRIS Donasi for Rp ${nominal}...`);

  const orderId = 'DON-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const qrisData = await pakasirService.createQris({
    amount: nominal,
    orderId,
  });

  let imageBuffer = null;
  if (qrisData.qr_url) {
    try {
      imageBuffer = await pakasirService.fetchQrImageBuffer(qrisData.qr_url);
    } catch (err) {
      logger.warn('Failed to download QRIS image buffer:', err.message);
    }
  }

  return {
    ...qrisData,
    imageBuffer,
  };
}

/**
 * Create a new donation record in DB
 * @param {object} param0 { telegramId, username, name, nominal, refNo, status }
 * @returns {Promise<object>}
 */
async function createDonationRecord({ telegramId, username, name, nominal, refNo = null, status = 'pending' }) {
  const donation = await database.insert('donations', (db) => ({
    id: generateId(db, 'DON'),
    telegramId,
    username: username || null,
    name: name || 'Anonim',
    nominal: Number(nominal),
    refNo: refNo || null,
    status, // 'pending' | 'completed' | 'cancelled'
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  logger.info(`Donation record created: ${donation.id} - ${donation.name} - Rp ${donation.nominal} (${donation.status})`);
  return donation;
}

/**
 * Check payment status of a donation via Pakasir API and update DB if success
 * @param {string} refNo
 * @returns {Promise<{success: boolean, status: string, donation?: object, raw?: object}>}
 */
async function checkDonationPayment(refNo) {
  const donation = database.findOne('donations', { refNo });
  const nominal = donation ? donation.nominal : 0;

  if (donation && donation.status === 'completed') {
    return { success: true, status: 'completed', donation };
  }

  const checkRes = await pakasirService.checkStatus(refNo, nominal);

  if (checkRes && checkRes.status === 'completed') {
    let updated = donation;
    if (donation) {
      updated = await database.update('donations', { id: donation.id }, {
        status: 'completed',
        payor: checkRes.customer_name || checkRes.payor || null,
        settledAt: checkRes.completed_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    logger.info(`Donation ${refNo} status updated to completed via Pakasir!`);
    return { success: true, status: 'completed', donation: updated, raw: checkRes };
  }

  const statusStr = checkRes ? checkRes.status : 'pending';
  return { success: false, status: statusStr, donation, raw: checkRes };
}

/**
 * Get all donations made by a user
 * @param {number} telegramId
 * @returns {Array}
 */
function getUserDonations(telegramId) {
  const donations = database.find('donations', { telegramId });
  return donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get all recorded donations
 * @returns {Array}
 */
function getAllDonations() {
  const donations = database.find('donations');
  return donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  generateDonationQris,
  createDonationRecord,
  checkDonationPayment,
  getUserDonations,
  getAllDonations,
};
