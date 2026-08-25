// ─────────────────────────────────────────────
// Donation Service
// Arasyarafi Payment Integration & Donation Management
// ─────────────────────────────────────────────
const database = require('../database');
const arasyarafiService = require('./arasyarafiService');
const { generateId } = require('../utils/id');
const logger = require('../utils/logger');

/**
 * Generate Payment Link for Donation
 * @param {object} param0 { nominal, customerName, telegramId }
 * @returns {Promise<object>}
 */
async function generateDonationQris({ nominal, customerName = 'Donatur Telegram', telegramId }) {
  const orderId = 'DON-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const paymentUrl = arasyarafiService.getPaymentUrl(orderId, nominal);

  return {
    depositId: orderId,
    order_id: orderId,
    payment_url: paymentUrl,
    total_payment: nominal,
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
 * Check payment status of a donation via arasyarafi API
 * @param {string} refNo
 * @returns {Promise<{success: boolean, status: string, donation?: object, raw?: object}>}
 */
async function checkDonationPayment(refNo) {
  const donation = database.findOne('donations', { refNo });

  if (donation && donation.status === 'completed') {
    return { success: true, status: 'completed', donation };
  }

  const res = await arasyarafiService.checkPaymentStatus(refNo);

  if (res.isPaid) {
    let updated = donation;
    if (donation) {
      updated = await database.update('donations', { id: donation.id }, {
        status: 'completed',
        settledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    logger.info(`Donation ${refNo} status updated to completed via Arasyarafi Payment!`);
    return { success: true, status: 'completed', donation: updated, raw: res.raw };
  }

  return { success: false, status: 'pending', donation, raw: res.raw };
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
