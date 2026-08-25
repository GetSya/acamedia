// ─────────────────────────────────────────────
// Mustika Payment Gateway Service
// (Tidak digunakan - stub kosong)
// ─────────────────────────────────────────────

module.exports = {
  getApiKey: () => '',
  getApiUser: () => '',
  setMustikaConfig: async () => {},
  createQris: async () => { throw new Error('Mustika tidak dikonfigurasi.'); },
  checkQris: async () => ({ status: 'failed' }),
  fetchQrImageBuffer: async () => { throw new Error('Mustika tidak dikonfigurasi.'); },
  getBalance: async () => null,
};
