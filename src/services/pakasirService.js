// ─────────────────────────────────────────────
// Pakasir Payment Gateway Service Compatibility Wrapper
// Redirects to RamaShop Payment Gateway
// ─────────────────────────────────────────────
const ramashopeService = require('./ramashopeService');

module.exports = {
  getSlug: () => 'ramashop',
  getApiKey: ramashopeService.getApiKey,
  setPakasirConfig: async ({ apiKey }) => ramashopeService.setRamashopeConfig({ apiKey }),
  createQris: async (data) => {
    const deposit = await ramashopeService.createDeposit(data);
    return {
      order_id: deposit.depositId,
      payment_number: deposit.qrString,
      total_payment: deposit.amount,
      expired_at: deposit.expiredAt,
      qr_url: deposit.qrUrl,
      ref_no: deposit.depositId,
    };
  },
  checkStatus: async (orderId) => {
    const res = await ramashopeService.checkDepositStatus(orderId);
    if (!res) return null;
    return {
      status: (res.status === 'success' || res.status === 'already') ? 'completed' : res.status,
      ...res,
    };
  },
  fetchQrImageBuffer: ramashopeService.fetchQrImageBuffer,
};
