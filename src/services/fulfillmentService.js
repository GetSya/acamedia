// ─────────────────────────────────────────────
// Order Fulfillment Service
// Animated 5-min preparation, 17-min retry state, & 30s admin spam notification loop
// ─────────────────────────────────────────────
const { Markup } = require('telegraf');
const userService = require('./userService');
const orderService = require('./orderService');
const productService = require('./productService');
const messageService = require('./messageService');
const { formatCurrency, escapeHtml } = require('../utils/format');
const logger = require('../utils/logger');

const STAGES = [
  'membuat',
  'mempersiapkan',
  'mengambil data',
  'mengambil kode OTP',
  'data sudah siap',
  'membuka ke ruang publik',
  'Memverifikasi identitas pengguna',
  'Memeriksa hak akses (otorisasi)',
  'Mengompresi atau memformat data',
];

// Active fulfillment sessions map
// Key: orderId -> Value: { orderId, buyerId, startTime, currentStageIndex, animInterval, adminSpamInterval, maxTimeout, userMsgId }
const activeFulfillments = new Map();

/**
 * Safely extract Telegram instance from bot, ctx, or telegram object
 * @param {object} bot
 * @returns {object|null}
 */
function getTelegram(bot) {
  if (!bot) return null;
  if (bot.telegram) return bot.telegram;
  if (typeof bot.sendMessage === 'function') return bot;
  return null;
}

/**
 * Start animated order fulfillment & admin notification spam loop
 * @param {object} bot - Telegraf bot instance, ctx, or telegram instance
 * @param {object} order - Order object
 */
async function startFulfillment(bot, order) {
  if (!order || !order.id) return;
  const orderId = order.id;
  const telegram = getTelegram(bot);

  if (!telegram) {
    logger.error(`Cannot start fulfillment for order ${orderId}: Invalid bot/telegram object`);
    return;
  }

  // Stop any existing session for this order
  stopFulfillment(orderId);

  const buyer = userService.getUserById(order.buyerId);
  if (!buyer || !buyer.telegramId) {
    logger.warn(`Cannot start fulfillment for order ${orderId}: Buyer not found`);
    return;
  }

  const startTime = Date.now();

  // 1. Send initial progress message to buyer
  const initialText =
    `⏳ <b>PROSES PENYIAPAN PESANAN (#${orderId})</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
    `<b>Total:</b> ${formatCurrency(order.total)}\n\n` +
    `<b>Status:</b> 🔄 <i>${STAGES[0]}</i>\n\n` +
    `<i>Mohon tunggu sejenak, sistem sedang mengolah pesanan Anda...</i>`;

  let userMsgId = null;
  try {
    const sentMsg = await telegram.sendMessage(buyer.telegramId, initialText, { parse_mode: 'HTML' });
    if (sentMsg) userMsgId = sentMsg.message_id;
  } catch (err) {
    logger.error(`Failed to send initial fulfillment msg to buyer ${buyer.telegramId}:`, err.message);
  }

  const session = {
    orderId,
    buyerId: order.buyerId,
    buyerTelegramId: buyer.telegramId,
    userMsgId,
    startTime,
    currentStageIndex: 0,
    animInterval: null,
    adminSpamInterval: null,
    maxTimeout: null,
  };

  // 2. Schedule Animation Updates (Every ~33.3 seconds for 9 stages over 300 seconds / 5 minutes)
  const STAGE_INTERVAL_MS = Math.floor(300000 / STAGES.length); // ~33333 ms

  session.animInterval = setInterval(async () => {
    session.currentStageIndex++;

    if (session.currentStageIndex < STAGES.length) {
      // Stage 1 through 8
      const stageText = STAGES[session.currentStageIndex];
      const updateText =
        `⏳ <b>PROSES PENYIAPAN PESANAN (#${orderId})</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
        `<b>Total:</b> ${formatCurrency(order.total)}\n\n` +
        `<b>Status:</b> 🔄 <i>${stageText}</i>\n\n` +
        `<i>Mohon tunggu sejenak, sistem sedang mengolah pesanan Anda...</i>`;

      if (session.userMsgId) {
        await telegram.editMessageText(session.buyerTelegramId, session.userMsgId, null, updateText, { parse_mode: 'HTML' }).catch(() => {});
      }
    } else {
      // 5 Minutes (300s) reached -> Enter Retry State: "Gagal. Mencoba kembali data"
      clearInterval(session.animInterval);
      session.animInterval = null;

      const failedRetryText =
        `⚠️ <b>PROSES PENYIAPAN PESANAN (#${orderId})</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
        `<b>Total:</b> ${formatCurrency(order.total)}\n\n` +
        `<b>Status:</b> ❌ <i>Gagal. Mencoba kembali data</i>\n\n` +
        `<i>Sistem sedang mengulang penyiapan data pesanan Anda... Mohon menunggu.</i>`;

      if (session.userMsgId) {
        await telegram.editMessageText(session.buyerTelegramId, session.userMsgId, null, failedRetryText, { parse_mode: 'HTML' }).catch(() => {});
      }
    }
  }, STAGE_INTERVAL_MS);

  // 3. Send Admin Notification Spam Loop (Every 30 seconds up to 17 minutes)
  session.lastAdminMessages = [];

  const sendAdminNotif = async () => {
    // Delete previous admin notification message(s) so chat doesn't get cluttered
    if (session.lastAdminMessages && session.lastAdminMessages.length > 0) {
      await messageService.deleteAdminNotificationMessages(telegram, session.lastAdminMessages).catch(() => {});
    }

    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
    const adminText =
      `🔔 <b>[PESANAN PERLU DIPROSES - ${elapsedMinutes} Menit]</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `Pembayaran <b>LUNAS</b> untuk Order <b>#${orderId}</b>!\n` +
      `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
      `<b>Buyer:</b> ${escapeHtml(buyer.firstName || buyer.username || buyer.id)}\n` +
      `<b>Total:</b> ${formatCurrency(order.total)}\n\n` +
      `<i>Silakan kirim data akun (Email & Password) atau selesaikan pesanan di bawah ini.</i>`;

    const adminButtons = Markup.inlineKeyboard([
      [Markup.button.callback('📧 Kirim Data Akun', `adm_send_acc_${orderId}`)],
      [Markup.button.callback('✅ Tandai Selesai', `adm_quick_done_${orderId}`)],
    ]);

    session.lastAdminMessages = await messageService.notifyAdmins(telegram, adminText, { reply_markup: adminButtons.reply_markup });
  };

  // Send first admin notification immediately
  await sendAdminNotif();

  // Spam admin every 30 seconds (30000 ms)
  session.adminSpamInterval = setInterval(sendAdminNotif, 30000);

  // 4. Max Timeout at 17 Minutes (1020000 ms)
  session.maxTimeout = setTimeout(async () => {
    logger.info(`Fulfillment timeout reached for order ${orderId} (17 mins)`);
    stopFulfillment(orderId, telegram);

    const shopSettings = productService.getShopSettings();
    const rawWa = (shopSettings.supportWhatsapp || '').replace(/[^0-9]/g, '');
    const rawTg = (shopSettings.supportTelegram || '').replace(/^@/, '').trim();

    let timeoutNotice =
      `⚠️ <b>PENYIAPAN PESANAN MELEWATI BATAS WAKTU (#${orderId})</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `Pesanan Anda belum direspon oleh Owner/Admin dalam waktu <b>17 menit</b>.\n\n` +
      `<i>Harap hubungi Admin/Support kami secara langsung melalui kontak di bawah ini:</i>`;

    const supportButtons = [];

    if (rawWa) {
      supportButtons.push([Markup.button.url('📱 WhatsApp Support', `https://wa.me/${rawWa}`)]);
    }
    if (rawTg) {
      supportButtons.push([Markup.button.url('✈️ Telegram Support', `https://t.me/${rawTg}`)]);
    }
    supportButtons.push([Markup.button.callback('🏠 Menu Utama', 'menu_main')]);

    try {
      await telegram.sendMessage(session.buyerTelegramId, timeoutNotice, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: supportButtons },
      });
    } catch (err) {
      logger.error(`Failed to send 17-min timeout notice to buyer ${session.buyerTelegramId}:`, err.message);
    }
  }, 1020000);

  activeFulfillments.set(orderId, session);
  logger.info(`Started order fulfillment loop for #${orderId}`);
}

/**
 * Stop active fulfillment loop & clear timers for an order
 * @param {string} orderId
 * @param {object} [bot]
 */
function stopFulfillment(orderId, bot = null) {
  const session = activeFulfillments.get(orderId);
  if (!session) return;

  if (session.animInterval) clearInterval(session.animInterval);
  if (session.adminSpamInterval) clearInterval(session.adminSpamInterval);
  if (session.maxTimeout) clearTimeout(session.maxTimeout);

  if (session.lastAdminMessages && session.lastAdminMessages.length > 0 && bot) {
    messageService.deleteAdminNotificationMessages(bot, session.lastAdminMessages).catch(() => {});
  }

  activeFulfillments.delete(orderId);
  logger.info(`Stopped fulfillment loop for order #${orderId}`);
}

/**
 * Complete fulfillment when admin sends account details (email & password)
 * @param {object} bot
 * @param {string} orderId
 * @param {string} accountData - formatted credentials text
 */
async function completeFulfillmentWithData(bot, orderId, accountData) {
  stopFulfillment(orderId, bot);
  const telegram = getTelegram(bot);

  const order = orderService.getOrderById(orderId);
  if (!order) return;

  await orderService.updateOrderStatus(orderId, 'completed');

  const buyer = userService.getUserById(order.buyerId);
  if (buyer && buyer.telegramId && telegram) {
    const successMsg =
      `🎉 <b>PESANAN SELESAI!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Order:</b> #${orderId}\n` +
      `<b>Produk:</b> ${escapeHtml(order.productName)}\n\n` +
      `🔑 <b>DATA AKUN / LISENSI PESANAN:</b>\n` +
      `<code>${escapeHtml(accountData)}</code>\n\n` +
      `Terima kasih telah berbelanja di toko kami! 🙏`;

    await telegram.sendMessage(buyer.telegramId, successMsg, { parse_mode: 'HTML' });
  }

  logger.info(`Order #${orderId} completed with credentials by admin.`);
}

/**
 * Complete fulfillment directly via quick check button
 * @param {object} bot
 * @param {string} orderId
 */
async function completeFulfillmentDirect(bot, orderId) {
  stopFulfillment(orderId, bot);
  const telegram = getTelegram(bot);

  const order = orderService.getOrderById(orderId);
  if (!order) return;

  await orderService.updateOrderStatus(orderId, 'completed');

  const buyer = userService.getUserById(order.buyerId);
  if (buyer && buyer.telegramId && telegram) {
    const successMsg =
      `🎉 <b>PESANAN SELESAI!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Order:</b> #${orderId}\n` +
      `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
      `<b>Status:</b> ✅ Completed\n\n` +
      `Pesanan Anda telah selesai diproses oleh admin. Terima kasih! 🙏`;

    await telegram.sendMessage(buyer.telegramId, successMsg, { parse_mode: 'HTML' });
  }

  logger.info(`Order #${orderId} completed directly by admin.`);
}

/**
 * Check if fulfillment is active for an order
 * @param {string} orderId
 * @returns {boolean}
 */
function isFulfillmentActive(orderId) {
  return activeFulfillments.has(orderId);
}

module.exports = {
  startFulfillment,
  stopFulfillment,
  completeFulfillmentWithData,
  completeFulfillmentDirect,
  isFulfillmentActive,
};
