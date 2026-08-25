// ─────────────────────────────────────────────
// Pakasir Payment Gateway Service
// (Tidak digunakan - stub kosong)
// ─────────────────────────────────────────────

module.exports = {
  getSlug: () => '',
  getApiKey: () => '',
  setPakasirConfig: async () => {},
  createQris: async () => { throw new Error('Pakasir tidak dikonfigurasi.'); },
  checkStatus: async () => null,
  fetchQrImageBuffer: async () => { throw new Error('Pakasir tidak dikonfigurasi.'); },
};
