// ─────────────────────────────────────────────
// Order Handler (Buyer side)
// Mustika Payment Integration & Status Checking
// ─────────────────────────────────────────────
const { Markup } = require('telegraf');
const orderService = require('../services/orderService');
const productService = require('../services/productService');
const userService = require('../services/userService');
const messageService = require('../services/messageService');
const ticketService = require('../services/ticketService');
const fulfillmentService = require('../services/fulfillmentService');
const { formatCurrency, formatDate, formatOrderStatus, escapeHtml } = require('../utils/format');
const { navRow, paginationRow, safeEditOrReply } = require('../utils/keyboard');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Show buyer's orders list
 */
async function showMyOrders(ctx, page = 0) {
  const user = userService.findByTelegramId(ctx.from.id);
  if (!user) return;

  const allOrders = orderService.getOrdersByBuyer(user.id);
  const activeOrders = allOrders.filter((o) => !['completed', 'cancelled', 'refunded'].includes(o.status));
  const finishedOrders = allOrders.filter((o) => ['completed', 'cancelled', 'refunded'].includes(o.status));

  const perPage = config.ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(activeOrders.length / perPage));
  const currentPage = Math.min(page, totalPages - 1);
  const start = Math.max(0, currentPage * perPage);
  const pageOrders = activeOrders.slice(start, start + perPage);

  if (activeOrders.length === 0) {
    const text = `📦 <b>PESANAN AKTIF</b>\n\nTidak ada pesanan aktif saat ini.`;
    const buttons = [];
    if (finishedOrders.length > 0) {
      buttons.push([Markup.button.callback(`📜 Lihat Pesanan Selesai (${finishedOrders.length})`, 'orders_finished')]);
    }
    buttons.push(navRow('menu_main'));
    return safeEditOrReply(ctx, text, { reply_markup: { inline_keyboard: buttons } });
  }

  let text = `📦 <b>PESANAN AKTIF</b> (${activeOrders.length})\n\n`;

  pageOrders.forEach((o, i) => {
    const num = start + i + 1;
    text += `<b>${num}.</b> #${o.id}\n`;
    text += `    ${escapeHtml(o.productName)} | ${formatCurrency(o.total)}\n`;
    text += `    ${formatOrderStatus(o.status)}\n\n`;
  });

  const buttons = pageOrders.map((o) => [
    Markup.button.callback(`📋 #${o.id}`, `order_${o.id}`),
  ]);

  if (totalPages > 1) {
    buttons.push(paginationRow('orders_page', currentPage, totalPages));
  }

  if (finishedOrders.length > 0) {
    buttons.push([Markup.button.callback(`📜 Lihat Pesanan Selesai (${finishedOrders.length})`, 'orders_finished')]);
  }

  buttons.push(navRow('menu_main'));

  return safeEditOrReply(ctx, text, { reply_markup: { inline_keyboard: buttons } });
}

/**
 * Show buyer's finished orders list (completed, cancelled, refunded)
 */
async function showFinishedOrders(ctx, page = 0) {
  const user = userService.findByTelegramId(ctx.from.id);
  if (!user) return;

  const allOrders = orderService.getOrdersByBuyer(user.id);
  const finishedOrders = allOrders.filter((o) => ['completed', 'cancelled', 'refunded'].includes(o.status));

  const perPage = config.ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(finishedOrders.length / perPage));
  const currentPage = Math.min(page, totalPages - 1);
  const start = Math.max(0, currentPage * perPage);
  const pageOrders = finishedOrders.slice(start, start + perPage);

  if (finishedOrders.length === 0) {
    const text = `📜 <b>PESANAN SELESAI</b>\n\nBelum ada pesanan yang selesai.`;
    const buttons = [
      [Markup.button.callback('◀️ Pesanan Aktif', 'my_orders')],
      navRow('menu_main'),
    ];
    return safeEditOrReply(ctx, text, { reply_markup: { inline_keyboard: buttons } });
  }

  let text = `📜 <b>RIWAYAT PESANAN SELESAI</b> (${finishedOrders.length})\n\n`;

  pageOrders.forEach((o, i) => {
    const num = start + i + 1;
    text += `<b>${num}.</b> #${o.id}\n`;
    text += `    ${escapeHtml(o.productName)} | ${formatCurrency(o.total)}\n`;
    text += `    ${formatOrderStatus(o.status)}\n\n`;
  });

  const buttons = pageOrders.map((o) => [
    Markup.button.callback(`📋 #${o.id}`, `order_${o.id}`),
  ]);

  if (totalPages > 1) {
    buttons.push(paginationRow('orders_finished_page', currentPage, totalPages));
  }

  buttons.push([Markup.button.callback('◀️ Kembali ke Pesanan Aktif', 'my_orders')]);
  buttons.push(navRow('menu_main'));

  return safeEditOrReply(ctx, text, { reply_markup: { inline_keyboard: buttons } });
}

/**
 * Show order detail
 */
async function showOrderDetail(ctx, orderId) {
  const user = userService.findByTelegramId(ctx.from.id);
  if (!user) return;

  const order = orderService.getOrderById(orderId);
  if (!order) {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Order tidak ditemukan.');
    return;
  }

  const isAdmin = userService.isAdmin(ctx.from.id);
  const isSeller = user.role === 'seller' && order.sellerId === user.id;
  if (order.buyerId !== user.id && !isAdmin && !isSeller) {
    if (ctx.callbackQuery) await ctx.answerCbQuery('Anda tidak memiliki akses ke order ini.');
    return;
  }

  const text =
    `🛒 <b>DETAIL ORDER</b>\n\n` +
    `<b>Order:</b> #${order.id}\n` +
    `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
    `<b>Harga:</b> ${formatCurrency(order.price)}\n` +
    `<b>Jumlah:</b> ${order.quantity}\n` +
    `<b>Total:</b> ${formatCurrency(order.total)}\n` +
    `<b>Status:</b> ${formatOrderStatus(order.status)}\n` +
    (order.paymentRefNo ? `<b>Ref No QRIS:</b> <code>${order.paymentRefNo}</code>\n` : '') +
    (order.ticketId ? `<b>Ticket:</b> #${order.ticketId}\n` : '') +
    `\n<b>Dibuat:</b> ${formatDate(order.createdAt)}\n`;

  const buttons = [];

  if (['pending', 'waiting_payment'].includes(order.status)) {
    buttons.push([Markup.button.callback('💳 Bayar Dengan QRIS', `order_qris_${order.id}`)]);
    buttons.push([Markup.button.callback('🔄 Cek Status Pembayaran', `order_checkpay_${order.id}`)]);
  }

  if (order.ticketId) {
    buttons.push([Markup.button.callback('🎫 Buka Ticket', `ticket_open_${order.ticketId}`)]);
  }

  if (['pending', 'waiting_payment'].includes(order.status)) {
    buttons.push([Markup.button.callback('❌ Batalkan Order', `order_cancel_${order.id}`)]);
  }

  buttons.push(navRow('my_orders'));

  return safeEditOrReply(ctx, text, { reply_markup: { inline_keyboard: buttons } });
}

/**
 * Display Mustika QRIS for an order
 */
async function showOrderQris(ctx, orderId) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('🔄 Memproses QRIS Pembayaran...').catch(() => {});
    }

    const user = ctx.from;
    const customerName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Pelanggan';

    const sendingMsg = await ctx.reply(`⏳ <i>Membuat Kode QRIS Pakasir untuk Order #${orderId}...</i>`, { parse_mode: 'HTML' });

    const qrisData = await orderService.createOrderPakasirQris(orderId, customerName, user.id);
    const order = orderService.getOrderById(orderId);

    const caption =
      `💳 <b>KODE QRIS PEMBAYARAN ORDER #${orderId}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
      `💰 <b>Total Bayar:</b> ${formatCurrency(order.total)}\n` +
      `🏷️ <b>Order ID:</b> <code>${qrisData.order_id || orderId}</code>\n\n` +
      `📲 <b>Langkah Pembayaran:</b>\n` +
      `1. Tangkap layar (screenshot) / simpan gambar QRIS di bawah ini.\n` +
      `2. Buka aplikasi e-Wallet atau Mobile Banking Anda.\n` +
      `3. Scan QRIS dan lakukan konfirmasi pembayaran sejumlah <b>${formatCurrency(order.total)}</b>.\n\n` +
      `<i>Setelah membayar, tekan <b>[🔄 Cek Status Pembayaran]</b> untuk memverifikasi secara otomatis.</i>`;

    const buttons = [
      [Markup.button.callback('🔄 Cek Status Pembayaran', `order_checkpay_${orderId}`)],
      [Markup.button.callback('📋 Detail Order', `order_${orderId}`)],
      navRow('my_orders'),
    ];

    await ctx.deleteMessage(sendingMsg.message_id).catch(() => {});

    if (qrisData.imageBuffer) {
      await ctx.replyWithPhoto(
        { source: qrisData.imageBuffer },
        { caption, parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
      );
    } else if (qrisData.qr_url) {
      await ctx.replyWithPhoto(
        qrisData.qr_url,
        { caption, parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
      );
    } else {
      await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
    }
  } catch (err) {
    logger.error(`Failed to show order QRIS (${orderId}):`, err.message);
    await ctx.reply(`❌ <b>Gagal menampilkan QRIS:</b> ${escapeHtml(err.message)}`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [navRow(`order_${orderId}`)] },
    });
  }
}

/**
 * Check payment status of an order via Pakasir API
 */
async function checkOrderPayment(ctx, orderId) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('🔄 Memeriksa status ke Pakasir...').catch(() => {});
    }

    const checkRes = await orderService.checkOrderPakasirPayment(orderId);

    if (checkRes.isPaid) {
      const order = checkRes.order || orderService.getOrderById(orderId);
      const notifText =
        `🎉 <b>PEMBAYARAN SUCCESS!</b>\n\n` +
        `Pembayaran untuk <b>Order #${orderId}</b> telah BERHASIL diverifikasi melalui Pakasir.\n` +
        `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
        `<b>Total:</b> ${formatCurrency(order.total)}\n` +
        (checkRes.raw?.customer_name ? `<b>Pembayar:</b> ${escapeHtml(checkRes.raw.customer_name)}\n` : '') +
        `<b>Status:</b> ✅ ${formatOrderStatus(order.status)}\n\n` +
        `Pesanan Anda sedang diproses oleh penjual/sistem. Terima kasih!`;

      await ctx.reply(notifText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            order.ticketId ? [Markup.button.callback('🎫 Buka Ticket Pesanan', `ticket_open_${order.ticketId}`)] : [],
            [Markup.button.callback('📋 Detail Order', `order_${orderId}`)],
            navRow('my_orders'),
          ].filter((row) => row.length > 0),
        },
      });

      // Notify seller / admins about successful payment
      const adminNotif =
        `✅ <b>PEMBAYARAN OTOMATIS BERHASIL (PAKASIR)</b>\n\n` +
        `<b>Order:</b> #${orderId}\n` +
        `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
        `<b>Total:</b> ${formatCurrency(order.total)}\n` +
        `<b>Order ID:</b> <code>${order.paymentRefNo || orderId}</code>`;

      // Start animated fulfillment & admin notification loop
      fulfillmentService.startFulfillment(ctx.telegram, order);
    } else {
      const rawStatus = checkRes.status || (checkRes.raw && checkRes.raw.status) || 'pending';
      const statusDesc = rawStatus === 'pending' ? 'Belum Dibayar / Pending' : rawStatus;
      await ctx.reply(
        `⏳ <b>PEMBAYARAN BELUM DITERIMA</b>\n\n` +
        `<b>Order:</b> #${orderId}\n` +
        `<b>Status Pakasir:</b> <i>${statusDesc}</i>\n\n` +
        `Jika Anda sudah mentransfer, mohon tunggu beberapa saat lalu tekan tombol <b>Cek Status Pembayaran</b> kembali.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('🔄 Cek Status Lagi', `order_checkpay_${orderId}`)],
              [Markup.button.callback('💳 Bayar Dengan QRIS', `order_qris_${orderId}`)],
              [Markup.button.callback('📋 Detail Order', `order_${orderId}`)],
            ],
          },
        }
      );
    }
  } catch (err) {
    logger.error(`Error checking payment for order ${orderId}:`, err.message);
    await ctx.reply(`❌ <b>Gagal mengecek pembayaran:</b> ${escapeHtml(err.message)}`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [navRow(`order_${orderId}`)] },
    });
  }
}

/**
 * Mark payment as done manually
 */
async function markPaid(ctx, orderId) {
  const user = userService.findByTelegramId(ctx.from.id);
  if (!user) return;

  const order = orderService.getOrderById(orderId);
  if (!order || order.buyerId !== user.id) {
    await ctx.answerCbQuery('Order tidak ditemukan.');
    return;
  }

  const result = await orderService.updateOrderStatus(orderId, 'payment_review');
  if (!result.success) {
    await ctx.answerCbQuery(result.error);
    return;
  }

  await ctx.answerCbQuery('Pembayaran dilaporkan untuk verifikasi admin.');

  const notifText =
    `🔔 <b>PEMBAYARAN DILAPORKAN (MANUAL)</b>\n\n` +
    `<b>Order:</b> #${orderId}\n` +
    `<b>Produk:</b> ${escapeHtml(order.productName)}\n` +
    `<b>Total:</b> ${formatCurrency(order.total)}\n` +
    `<b>Buyer:</b> ${escapeHtml(user.firstName || user.username)}\n\n` +
    `Silakan verifikasi pembayaran manual.`;

  const notifButtons = [
    [
      Markup.button.callback('✅ Payment Berhasil', `adm_quick_pay_${orderId}_paid`),
      Markup.button.callback('❌ Payment Gagal', `adm_quick_pay_${orderId}_cancelled`),
    ],
  ];

  const ticket = order.ticketId ? ticketService.getTicketById(order.ticketId) : null;
  if (ticket) {
    await messageService.notifyTicketHandler(
      { telegram: ctx.telegram },
      ticket,
      notifText,
      { reply_markup: { inline_keyboard: notifButtons } }
    );
  } else {
    await messageService.notifyAdmins(
      { telegram: ctx.telegram },
      notifText,
      { reply_markup: { inline_keyboard: notifButtons } }
    );
  }

  await showOrderDetail(ctx, orderId);
}

/**
 * Cancel order
 */
async function cancelOrder(ctx, orderId) {
  const user = userService.findByTelegramId(ctx.from.id);
  if (!user) return;

  const order = orderService.getOrderById(orderId);
  if (!order || order.buyerId !== user.id) {
    await ctx.answerCbQuery('Order tidak ditemukan.');
    return;
  }

  const result = await orderService.updateOrderStatus(orderId, 'cancelled');
  if (!result.success) {
    await ctx.answerCbQuery(result.error);
    return;
  }

  await productService.updateProduct(order.productId, {
    stock: (productService.getProductById(order.productId)?.stock || 0) + order.quantity,
    status: 'active',
  });

  if (order.ticketId) {
    await ticketService.closeTicket(order.ticketId);
  }

  await ctx.answerCbQuery('Order dibatalkan.');
  await showOrderDetail(ctx, orderId);

  logger.info(`Order ${orderId} cancelled by buyer ${user.id}`);
}

function register(bot) {
  bot.action('my_orders', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await showMyOrders(ctx, 0);
  });

  bot.command('orders', async (ctx) => {
    await showMyOrders(ctx, 0);
  });

  bot.action(/^orders_page_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const page = parseInt(ctx.match[1], 10);
    await showMyOrders(ctx, page);
  });

  bot.action('orders_finished', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await showFinishedOrders(ctx, 0);
  });

  bot.action(/^orders_finished_page_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const page = parseInt(ctx.match[1], 10);
    await showFinishedOrders(ctx, page);
  });

  bot.action(/^order_(ORD-\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const orderId = ctx.match[1];
    await showOrderDetail(ctx, orderId);
  });

  bot.action(/^order_qris_(ORD-\d+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    await showOrderQris(ctx, orderId);
  });

  bot.action(/^order_checkpay_(ORD-\d+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    await checkOrderPayment(ctx, orderId);
  });

  bot.action(/^order_pay_(ORD-\d+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    await markPaid(ctx, orderId);
  });

  bot.action(/^order_cancel_(ORD-\d+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    await cancelOrder(ctx, orderId);
  });
}

module.exports = { register, showMyOrders, showOrderDetail, showOrderQris, checkOrderPayment };
