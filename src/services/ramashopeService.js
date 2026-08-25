// ─────────────────────────────────────────────
// RamaShop Payment Gateway Service
// Integration for QRIS Deposit & Status Check
// ─────────────────────────────────────────────
const axios = require('axios');
const database = require('../database');
const logger = require('../utils/logger');

const BASE_URL = 'https://ramashop.my.id/api/public';
const DEFAULT_API_KEY = 'rg_1bee3cae4d27879998348ef69e4874';

/**
 * Get configured RamaShop API Key
 * @returns {string}
 */
function getApiKey() {
  const db = database.get();
  return (db.settings && db.settings.ramashopeApiKey) || process.env.RAMASHOPE_API_KEY || DEFAULT_API_KEY;
}

/**
 * Update RamaShop API Key in database
 * @param {object} param0 { apiKey }
 */
async function setRamashopeConfig({ apiKey }) {
  await database.mutate((db) => {
    if (!db.settings) db.settings = {};
    if (apiKey !== undefined) db.settings.ramashopeApiKey = apiKey.trim();
  });
  logger.info('RamaShop Payment config updated.');
}

/**
 * Cek saldo RamaShop
 * @returns {Promise<object>} { balance, ... }
 */
async function getBalance() {
  const key = getApiKey();
  if (!key) throw new Error('RamaShop API Key belum dikonfigurasi.');

  const res = await axios.get(`${BASE_URL}/balance`, {
    headers: { 'X-API-Key': key },
    validateStatus: () => true,
  });

  if (res.data && res.data.error) {
    throw new Error(res.data.error);
  }

  if (res.data && res.data.data) {
    return res.data.data;
  }

  return res.data;
}

/**
 * Buat Deposit QRIS via RamaShop
 * @param {object} param0
 * @param {number} param0.amount Nominal pembayaran
 * @param {string} [param0.apiKey] Override API Key
 * @returns {Promise<object>} { depositId, qrUrl, amount, expiredAt, ... }
 */
async function createDeposit({ amount, apiKey }) {
  const key = apiKey || getApiKey();
  if (!key) throw new Error('RamaShop API Key belum dikonfigurasi.');

  const finalAmount = Math.round(Number(amount));

  logger.info(`Creating RamaShop QRIS deposit - Rp ${finalAmount}...`);

  const res = await axios.post(
    `${BASE_URL}/deposit/create`,
    { amount: finalAmount, method: 'qris' },
    { headers: { 'X-API-Key': key, 'Content-Type': 'application/json' }, validateStatus: () => true }
  );

  if (res.data && res.data.error) {
    throw new Error(res.data.error);
  }

  if (!res.data || !res.data.data) {
    throw new Error(res.data?.message || 'Respon API RamaShop tidak valid');
  }

  const data = res.data.data;
  const depositId = data.depositId;

  // Generate QR image URL dari payment_number / qr / qrString / qrUrl
  const qrString = data.qr || data.payment_number || data.qrString || data.qr_code || null;
  const qrUrl = qrString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=750x750&data=${encodeURIComponent(qrString)}&qzone=4&format=png`
    : (data.qrUrl || data.qr_url || null);

  logger.info(`RamaShop deposit created. depositId: ${depositId}`);

  return {
    depositId,
    qrUrl,
    qrString,
    amount: data.amount || finalAmount,
    expiredAt: data.expiredAt || data.expired_at || null,
    raw: data,
  };
}

/**
 * Cek status deposit via RamaShop
 * @param {string} depositId
 * @param {string} [apiKey] Override API Key
 * @returns {Promise<object|null>} { status, depositId, amount, ... } atau null
 */
async function checkDepositStatus(depositId, apiKey) {
  try {
    const key = apiKey || getApiKey();
    if (!key) throw new Error('RamaShop API Key belum dikonfigurasi.');

    const res = await axios.get(`${BASE_URL}/deposit/status/${encodeURIComponent(depositId)}`, {
      headers: { 'X-API-Key': key },
      validateStatus: () => true,
    });

    if (res.data && res.data.data) {
      return res.data.data;
    }
    return res.data || null;
  } catch (e) {
    logger.warn(`Check deposit status RamaShop error for ${depositId}: ${e.message}`);
    return null;
  }
}

/**
 * Download QRIS image buffer dari URL
 * @param {string} qrUrl
 * @returns {Promise<Buffer>}
 */
async function fetchQrImageBuffer(qrUrl) {
  const fetch = require('node-fetch');
  const response = await fetch(qrUrl);
  if (!response.ok) {
    throw new Error(`Gagal mengunduh gambar QRIS (HTTP ${response.status})`);
  }
  return response.buffer();
}

module.exports = {
  getApiKey,
  setRamashopeConfig,
  getBalance,
  createDeposit,
  checkDepositStatus,
  fetchQrImageBuffer,
};
