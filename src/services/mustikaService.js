// ─────────────────────────────────────────────
// Mustika Payment Gateway Service Compatibility Wrapper
// Redirects to Pakasir Payment Gateway
// ─────────────────────────────────────────────
const pakasirService = require('./pakasirService');

module.exports = {
  getApiKey: pakasirService.getApiKey,
  getApiUser: pakasirService.getSlug,
  setMustikaConfig: async ({ apiKey, apiUser }) => pakasirService.setPakasirConfig({ apiKey, slug: apiUser }),
  createQris: async (data) => pakasirService.createQris(data),
  checkQris: async (refNo, amount) => {
    const res = await pakasirService.checkStatus(refNo, amount);
    return res ? { status: res.status === 'completed' ? 'success' : res.status, ...res } : { status: 'failed' };
  },
  fetchQrImageBuffer: pakasirService.fetchQrImageBuffer,
  getBalance: async () => ({ username: pakasirService.getSlug(), balance_available: 0, balance_pending: 0 }),
};
