// -------------------------------------------------
// QRIS Service (api-mininxd)
// Generate Dynamic QRIS image via api-mininxd
// -------------------------------------------------
const fetch = require('node-fetch');
const logger = require('../utils/logger');

const API_URL   = 'https://api-mininxd.vercel.app/qris';
const QRIS_CODE = '00020101021126570011ID.DANA.WWW011893600915390930088102099093008810303UMI51440014ID.CO.QRIS.WWW0215ID10254040171760303UMI5204737253033605802ID5910Jojo Store6010Kota Bogor61051634163046B01';
const DEF = { type: 'images', tax: 'n', taxtype: 'p', fee: '0' };

/**
 * Generate dynamic QRIS for a given amount
 * @param {number} amount
 * @returns {Promise<{imageBuffer: Buffer, amount: number}>}
 */
async function createQris(amount) {
  const finalAmount = Math.round(Number(amount));
  const params = new URLSearchParams({
    qris:    QRIS_CODE,
    nominal: String(finalAmount),
    type:    DEF.type,
    tax:     DEF.tax,
    taxtype: DEF.taxtype,
    fee:     DEF.fee,
  });
  const url = API_URL + '?' + params.toString();
  logger.info('[QRIS] Generating QRIS for Rp ' + finalAmount);

  const response = await fetch(url, { timeout: 15000 });
  if (!response.ok) {
    throw new Error('Gagal mengambil QRIS dari API (HTTP ' + response.status + ')');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('image')) {
    const body = await response.text();
    throw new Error('API tidak mengembalikan gambar: ' + body.substring(0, 200));
  }
  const buffer = await response.buffer();
  logger.info('[QRIS] QRIS image generated (' + buffer.length + ' bytes)');
  return { imageBuffer: buffer, amount: finalAmount };
}

module.exports = { createQris, QRIS_CODE, API_URL };
