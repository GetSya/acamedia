// ─────────────────────────────────────────────
// Pakasir Payment Gateway Service
// Integration for Dynamic QRIS & Transaction Status Check
// ─────────────────────────────────────────────
const axios = require('axios');
const fetch = require('node-fetch');
const database = require('../database');
const config = require('../config');
const logger = require('../utils/logger');

const DEFAULT_SLUG = process.env.PAKASIR_SLUG || 'default_slug';
const DEFAULT_API_KEY = process.env.PAKASIR_API_KEY || 'default_api_key';

/**
 * Get configured Pakasir Slug / Project ID
 * @returns {string}
 */
function getSlug() {
  const db = database.get();
  return (db.settings && db.settings.pakasirSlug) || process.env.PAKASIR_SLUG || DEFAULT_SLUG;
}

/**
 * Get configured Pakasir API Key
 * @returns {string}
 */
function getApiKey() {
  const db = database.get();
  return (db.settings && db.settings.pakasirApiKey) || process.env.PAKASIR_API_KEY || DEFAULT_API_KEY;
}

/**
 * Update Pakasir Payment settings in database
 * @param {object} param0 { slug, apiKey }
 */
async function setPakasirConfig({ slug, apiKey }) {
  await database.mutate((db) => {
    if (!db.settings) db.settings = {};
    if (slug !== undefined) db.settings.pakasirSlug = slug.trim();
    if (apiKey !== undefined) db.settings.pakasirApiKey = apiKey.trim();
  });
  logger.info('Pakasir Payment config updated.');
}

/**
 * Create Dynamic QRIS via Pakasir API
 * @param {object} param0
 * @param {number} param0.amount Nominal pembayaran (tanpa admin fee)
 * @param {string} [param0.orderId] Custom Order ID
 * @param {string} [param0.slug] Pakasir Project Slug
 * @param {string} [param0.apiKey] Pakasir API Key
 * @returns {Promise<object>} Payment object from Pakasir (order_id, payment_number, total_payment, expired_at)
 */
async function createQris({ amount, orderId, slug, apiKey }) {
  const projectSlug = slug || getSlug();
  const key = apiKey || getApiKey();

  if (!projectSlug || projectSlug === 'default_slug' || !key || key === 'default_api_key') {
    throw new Error('Konfigurasi `pakasir.slug` atau `pakasir.apikey` belum diisi.');
  }

  const finalOrderId = orderId || ('ORD-' + Math.random().toString(36).substring(2, 10).toUpperCase());
  const finalAmount = Math.round(Number(amount));

  logger.info(`Creating Pakasir QRIS for Order ${finalOrderId} - Rp ${finalAmount}...`);

  const res = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
    project: projectSlug,
    order_id: finalOrderId,
    amount: finalAmount,
    api_key: key,
  });

  if (!res.data || !res.data.payment) {
    throw new Error(res.data?.message || 'Respon API Pakasir tidak valid');
  }

  const payment = res.data.payment;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=750x750&data=${encodeURIComponent(payment.payment_number)}&qzone=4&format=png`;

  logger.info(`Pakasir QRIS created successfully. Order ID: ${payment.order_id}`);

  return {
    order_id: payment.order_id,
    payment_number: payment.payment_number,
    total_payment: payment.total_payment || finalAmount,
    expired_at: payment.expired_at,
    qr_url: qrUrl,
    ref_no: payment.order_id,
  };
}

/**
 * Check transaction status via Pakasir API
 * @param {string} orderId Order ID
 * @param {number} amount Amount expected
 * @param {string} [slug] Project Slug
 * @param {string} [apiKey] API Key
 * @returns {Promise<object|null>} Transaction object or null
 */
async function checkStatus(orderId, amount, slug, apiKey) {
  try {
    const projectSlug = slug || getSlug();
    const key = apiKey || getApiKey();
    const finalAmount = Math.round(Number(amount));

    const res = await axios.get(
      `https://app.pakasir.com/api/transactiondetail?project=${encodeURIComponent(projectSlug)}&amount=${finalAmount}&order_id=${encodeURIComponent(orderId)}&api_key=${encodeURIComponent(key)}`
    );

    return res.data ? res.data.transaction : null;
  } catch (e) {
    logger.warn(`Check status Pakasir error for ${orderId}: ${e.message}`);
    return null;
  }
}

/**
 * Download QRIS image buffer from qr_url or raw payment_number
 * @param {string} qrUrlOrData
 * @returns {Promise<Buffer>}
 */
async function fetchQrImageBuffer(qrUrlOrData) {
  let targetUrl = qrUrlOrData;
  if (!qrUrlOrData.startsWith('http')) {
    targetUrl = `https://api.qrserver.com/v1/create-qr-code/?size=750x750&data=${encodeURIComponent(qrUrlOrData)}&qzone=4&format=png`;
  }

  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Gagal mengunduh gambar QRIS (HTTP ${response.status})`);
  }

  const buffer = await response.buffer();
  return buffer;
}

module.exports = {
  getSlug,
  getApiKey,
  setPakasirConfig,
  createQris,
  checkStatus,
  fetchQrImageBuffer,
};
