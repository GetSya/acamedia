// ─────────────────────────────────────────────
// Mustika Payment Gateway Service Compatibility Wrapper
// Redirects to RamaShop Payment Gateway
// ─────────────────────────────────────────────
const ramashopeService = require('./ramashopeService');

module.exports = {
  getApiKey: ramashopeService.getApiKey,
  getApiUser: () => 'ramashop',
  setMustikaConfig: async ({ apiKey }) => ramashopeService.setRamashopeConfig({ apiKey }),
  createQris: async (data) => ramashopeService.createDeposit(data),
  checkQris: async (refNo) => {
    const res = await ramashopeService.checkDepositStatus(refNo);
    const isPaid = res && (res.status === 'success' || res.status === 'already');
    return res ? { status: isPaid ? 'success' : res.status, ...res } : { status: 'failed' };
  },
  fetchQrImageBuffer: ramashopeService.fetchQrImageBuffer,
  getBalance: async () => ramashopeService.getBalance(),
};
