// ─────────────────────────────────────────────
// PayHook Payment Service & Webhook Listener
// Integrasi PayHook Android Webhook (https://payhook.freehost.id/)
// ─────────────────────────────────────────────
const http = require('http');
const database = require('../database');
const logger = require('../utils/logger');
const fulfillmentService = require('./fulfillmentService');
const { formatCurrency, escapeHtml } = require('../utils/format');

const DEFAULT_TOKEN = process.env.PAYHOOK_TOKEN || 'payhook_secret_token';
const DEFAULT_PORT = process.env.PAYHOOK_PORT || 3000;

/**
 * Get configured PayHook Auth Token
 * @returns {string}
 */
function getToken() {
  const db = database.get();
  return (db.settings && db.settings.payhookToken) || process.env.PAYHOOK_TOKEN || DEFAULT_TOKEN;
}

/**
 * Get configured PayHook Webhook Port
 * @returns {number}
 */
function getPort() {
  const db = database.get();
  return (db.settings && db.settings.payhookPort) || Number(process.env.PAYHOOK_PORT) || DEFAULT_PORT;
}

/**
 * Update PayHook Configuration in Database
 * @param {object} param0 { token, port }
 */
async function setPayhookConfig({ token, port }) {
  await database.mutate((db) => {
    if (!db.settings) db.settings = {};
    if (token !== undefined) db.settings.payhookToken = token.trim();
    if (port !== undefined) db.settings.payhookPort = Number(port) || 3000;
  });
  logger.info('PayHook Payment config updated.');
}

let server = null;
let telegramBotClient = null;

/**
 * Register Telegram Client instance for sending notifications
 * @param {object} botClient
 */
function setTelegramClient(botClient) {
  telegramBotClient = botClient;
}

/**
 * Process incoming Webhook Payload from PayHook App
 * @param {object} payload
 * @param {object} headers
 * @returns {Promise<object>}
 */
async function processWebhookPayload(payload, headers = {}) {
  const eventId = payload.event_id || payload.reference || ('evt_' + Date.now());
  const eventType = payload.event_type || 'payment.incoming';

  // Handle Heartbeat ping
  if (payload.type === 'heartbeat' || eventType === 'heartbeat') {
    logger.info(`[PayHook] Heartbeat received from device: ${payload.device_id || 'unknown'}`);
    return { success: true, message: 'Heartbeat acknowledged' };
  }

  // Idempotency check to prevent duplicate processing
  const db = database.get();
  const logs = db.payhookLogs || [];
  const existingLog = logs.find((l) => l.eventId === eventId);
  if (existingLog) {
    logger.info(`[PayHook] Event ${eventId} already processed previously.`);
    return { success: true, message: 'Event already processed' };
  }

  const amount = Number(payload.amount) || 0;
  const source = payload.source || 'E-Wallet/Bank';
  const reference = payload.reference || payload.notification_title || '';
  const notifText = payload.notification_text || '';
  const timestamp = payload.timestamp || new Date().toISOString();

  logger.info(`[PayHook] Incoming payment detected: Rp ${amount} via ${source} (Ref: ${reference})`);

  // Record transaction log in database
  await database.insert('payhookLogs', (dbState) => {
    if (!dbState.payhookLogs) dbState.payhookLogs = [];
    return {
      id: 'PH-' + Date.now(),
      eventId,
      amount,
      source,
      reference,
      notifText,
      timestamp,
      createdAt: new Date().toISOString(),
    };
  });

  // 1. Search pending orders matching the payment
  const pendingOrders = database.find('orders').filter((o) => ['waiting_payment', 'pending'].includes(o.status));
  
  // Try matching by reference ID / order ID text first
  let matchedOrder = pendingOrders.find((o) => 
    (o.paymentRefNo && reference.includes(o.paymentRefNo)) || 
    (o.id && reference.includes(o.id)) ||
    (o.id && notifText.includes(o.id))
  );

  // Fallback match by exact total amount
  if (!matchedOrder) {
    matchedOrder = pendingOrders.find((o) => Number(o.total) === amount);
  }

  if (matchedOrder) {
    logger.info(`[PayHook] Payment matched for Order #${matchedOrder.id}`);

    // Update order status to paid
    await database.update('orders', { id: matchedOrder.id }, {
      status: 'paid',
      paymentRefNo: eventId,
      payhookSource: source,
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const updatedOrder = database.findById('orders', matchedOrder.id);

    // Send Telegram notifications if bot client is connected
    if (telegramBotClient && updatedOrder) {
      const buyerUser = database.findById('users', updatedOrder.buyerId);
      if (buyerUser && buyerUser.telegramId) {
        const buyerMsg =
          `🎉 <b>PEMBAYARAN SUCCESS!</b>\n\n` +
          `Pembayaran untuk <b>Order #${updatedOrder.id}</b> sebesar <b>${formatCurrency(amount)}</b> telah BERHASIL diverifikasi via PayHook (${escapeHtml(source)}).\n` +
          `<b>Produk:</b> ${escapeHtml(updatedOrder.productName)}\n` +
          `<b>Status:</b> ✅ LUNAS\n\n` +
          `Pesanan Anda sedang diproses. Terima kasih!`;

        telegramBotClient.sendMessage(buyerUser.telegramId, buyerMsg, { parse_mode: 'HTML' }).catch((err) => {
          logger.warn(`Failed to notify buyer ${buyerUser.telegramId}: ${err.message}`);
        });
      }

      // Start automatic fulfillment & seller/admin notification loop
      fulfillmentService.startFulfillment(telegramBotClient, updatedOrder);
    }

    return { success: true, matchedOrderId: matchedOrder.id };
  }

  // 2. Search pending donations matching the payment
  const pendingDonations = database.find('donations', { status: 'pending' });
  let matchedDonation = pendingDonations.find((d) => 
    (d.refNo && reference.includes(d.refNo)) || Number(d.nominal) === amount
  );

  if (matchedDonation) {
    logger.info(`[PayHook] Payment matched for Donation ${matchedDonation.id}`);

    await database.update('donations', { id: matchedDonation.id }, {
      status: 'completed',
      payor: source,
      settledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (telegramBotClient && matchedDonation.telegramId) {
      const donMsg =
        `🎉 <b>DONASI BERHASIL DITERIMA!</b>\n\n` +
        `Donasi sebesar <b>${formatCurrency(amount)}</b> via PayHook (${escapeHtml(source)}) telah diterima.\n` +
        `Terima kasih banyak atas dukungan Anda! ❤️`;

      telegramBotClient.sendMessage(matchedDonation.telegramId, donMsg, { parse_mode: 'HTML' }).catch(() => {});
    }

    return { success: true, matchedDonationId: matchedDonation.id };
  }

  logger.info(`[PayHook] Payment Rp ${amount} recorded, no pending order/donation matched.`);
  return { success: true, matched: false };
}

/**
 * Start HTTP Webhook listener server
 * @param {object} [botClient] Optional Telegraf bot client instance
 */
function startWebhookServer(botClient) {
  if (botClient) telegramBotClient = botClient;

  if (server) {
    try { server.close(); } catch (e) {}
  }

  const port = getPort();

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && (url.pathname === '/payhook' || url.pathname === '/payhook/heartbeat')) {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const configuredToken = getToken();

          // Auth validation if token is set
          if (configuredToken) {
            const authHeader = req.headers['authorization'] || '';
            const apiKeyHeader = req.headers['x-api-key'] || '';
            const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();

            if (bearerToken !== configuredToken && apiKeyHeader !== configuredToken && authHeader !== configuredToken) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Unauthorized', message: 'Token PayHook tidak sesuai' }));
            }
          }

          const payload = JSON.parse(body);
          const result = await processWebhookPayload(payload, req.headers);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', ...result }));
        } catch (err) {
          logger.error('[PayHook] Error handling webhook request:', err.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request', message: err.message }));
        }
      });
    } else if (req.method === 'GET' && (url.pathname === '/payhook' || url.pathname === '/payhook/status')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'online',
        service: 'PayHook Webhook Listener',
        tokenConfigured: Boolean(getToken()),
        port,
        time: new Date().toISOString(),
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, () => {
    logger.info(`[PayHook] Webhook listener listening on http://0.0.0.0:${port}/payhook`);
  });

  server.on('error', (err) => {
    logger.error(`[PayHook] Server error on port ${port}:`, err.message);
  });

  return server;
}

module.exports = {
  getToken,
  getPort,
  setPayhookConfig,
  setTelegramClient,
  startWebhookServer,
  processWebhookPayload,
};
