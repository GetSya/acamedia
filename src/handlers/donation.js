// ─────────────────────────────────────────────
// Donation Handler
// Handles RamaShop QRIS donation generation, custom amounts, check & history
// ─────────────────────────────────────────────
const { Markup } = require('telegraf');
const donationService = require('../services/donationService');
const { formatCurrency, formatDate, escapeHtml } = require('../utils/format');
const { donationPresetMenu, donationActionMenu, safeEditOrReply, navRow, backButton } = require('../utils/keyboard');
const logger = require('../utils/logger');

// Store session for users inputting custom donation amounts
const donationSessions = new Map();

/**
 * Show Donation Menu with preset options
 * @param {object} ctx
 */
async function showDonationMenu(ctx) {
  // Clear any existing user input session
  if (ctx.from) donationSessions.delete(ctx.from.id);

  const text =
    `🎁 <b>FITUR DONASI QRIS RAMASHOP</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `Dukung toko dan pengembangan layanan kami! 🙏\n` +
    `Setiap donasi dari Anda sangat berarti untuk kelangsungan operasional dan peningkatan fasilitas bot.\n\n` +
    `Silakan pilih <b>preset nominal donasi</b> di bawah ini atau tentukan <b>nominal custom</b> sesuai keinginan Anda:`;

  const keyboard = donationPresetMenu();
  return safeEditOrReply(ctx, text, keyboard);
}

/**
 * Generate and send payment link for chosen nominal
 * @param {object} ctx
 * @param {number} nominal
 */
async function handleGenerateQris(ctx, nominal) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('🔄 Membuat Link Pembayaran Donasi...').catch(() => {});
    }

    const user = ctx.from;
    const customerName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Donatur';

    // Generate payment link
    const qrisData = await donationService.generateDonationQris({
      nominal,
      customerName,
      telegramId: user.id,
    });

    // Save pending donation record
    await donationService.createDonationRecord({
      telegramId: user.id,
      username: user.username,
      name: customerName,
      nominal,
      refNo: qrisData.order_id,
      status: 'pending',
    });

    const caption =
      `🎁 <b>LINK PEMBAYARAN DONASI</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Nominal Donasi:</b> ${formatCurrency(nominal)}\n` +
      `🏷️ <b>Ref ID:</b> <code>${qrisData.order_id}</code>\n\n` +
      `📲 <b>Link Pembayaran:</b>\n` +
      `<code>${qrisData.payment_url}</code>\n\n` +
      `<i>Klik tombol <b>[💳 Bayar Sekarang]</b> untuk melakukan pembayaran. Setelah selesai, tekan <b>[🔄 Cek Status Pembayaran]</b>.</i>`;

    const keyboard = donationActionMenu(nominal, qrisData.order_id, qrisData.payment_url);

    return safeEditOrReply(ctx, caption, keyboard);
  } catch (err) {
    logger.error('Failed to generate donation payment link:', err.message);
    await ctx.reply(`❌ <b>Gagal membuat Link Pembayaran Donasi:</b> ${escapeHtml(err.message)}`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [navRow('menu_donate')] },
    });
  }
}

/**
 * Check donation payment status via arasyarafi API
 * @param {object} ctx
 * @param {string} refNo
 */
async function handleCheckDonationPayment(ctx, refNo) {
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('🔄 Mengecek status pembayaran...').catch(() => {});
    }

    const checkResult = await donationService.checkDonationPayment(refNo);

    if (checkResult.success) {
      const donation = checkResult.donation || {};
      const text =
        `🎉 <b>DONASI BERHASIL DITERIMA!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>ID Donasi:</b> <code>${donation.id || '-'}</code>\n` +
        `<b>Deposit ID:</b> <code>${refNo}</code>\n` +
        `<b>Donatur:</b> ${escapeHtml(donation.name || 'Donatur')}\n` +
        `<b>Nominal:</b> ${formatCurrency(donation.nominal || 0)}\n` +
        `<b>Status:</b> ✅ LUNAS (Success)\n\n` +
        `Terima kasih banyak atas donasi Anda! Dukungan Anda sangat berarti bagi kelangsungan toko kami. ❤️`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('📜 Lihat Riwayat Donasi Saya', 'donate_history')],
            [Markup.button.callback('🏠 Menu Utama', 'menu_main')],
          ],
        },
      };

      return safeEditOrReply(ctx, text, keyboard);
    } else {
      const donation = checkResult.donation;
      const payUrl = donation?.paymentUrl ||
        `https://store.arasyarafi.xyz/pay?pay=${donation?.nominal || 0}&order_id=${refNo}`;
      await ctx.reply(
        `⏳ <b>PEMBAYARAN BELUM DITERIMA</b>\n\n` +
        `<b>Ref ID:</b> <code>${refNo}</code>\n` +
        `<b>Status Gateway:</b> <i>Belum Dibayar (status: 0)</i>\n\n` +
        `Silakan selesaikan pembayaran via link, lalu tekan tombol <b>Cek Status Pembayaran</b> kembali.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.url('💳 Bayar Sekarang', payUrl)],
              [Markup.button.callback('🔄 Cek Status Pembayaran', `donate_checkpay_${refNo}`)],
              navRow('menu_donate'),
            ],
          },
        }
      );
    }
  } catch (err) {
    logger.error('Error checking donation payment:', err.message);
    await ctx.reply(`❌ <b>Gagal mengecek pembayaran:</b> ${escapeHtml(err.message)}`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [navRow('menu_donate')] },
    });
  }
}

/**
 * Show Custom Nominal Prompt
 * @param {object} ctx
 */
async function showCustomNominalPrompt(ctx) {
  donationSessions.set(ctx.from.id, { step: 'AWAITING_NOMINAL' });

  const text =
    `✏️ <b>INPUT NOMINAL DONASI CUSTOM</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `Silakan ketik angka nominal donasi yang ingin Anda berikan.\n` +
    `Contoh: <code>15000</code> atau <code>25000</code>\n\n` +
    `<i>Catatan: Minimal donasi adalah Rp 1.000.</i>`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [backButton('menu_donate', '◀️ Batal')],
    },
  };

  return safeEditOrReply(ctx, text, keyboard);
}

/**
 * Handle custom nominal text input
 * @param {object} ctx
 * @returns {Promise<boolean>} returns true if handled
 */
async function handleDonationInput(ctx) {
  const session = donationSessions.get(ctx.from.id);
  if (!session || session.step !== 'AWAITING_NOMINAL') return false;

  const rawText = ctx.message.text.trim();
  // Extract digits
  const cleanNum = rawText.replace(/[^0-9]/g, '');
  const nominal = parseInt(cleanNum, 10);

  if (isNaN(nominal) || nominal < 1000) {
    await ctx.reply(
      '⚠️ <b>Nominal tidak valid!</b>\nSilakan masukkan angka nominal yang benar (minimal Rp 1.000).\nContoh: <code>15000</code>',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [backButton('menu_donate', '◀️ Batal')] },
      }
    );
    return true;
  }

  // Clear session state
  donationSessions.delete(ctx.from.id);

  // Generate QRIS for custom nominal
  await handleGenerateQris(ctx, nominal);
  return true;
}

/**
 * Confirm and record donation manually
 * @param {object} ctx
 * @param {number} nominal
 */
async function handleConfirmDonation(ctx, nominal) {
  try {
    const user = ctx.from;
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Donatur';

    const donation = await donationService.createDonationRecord({
      telegramId: user.id,
      username: user.username,
      name,
      nominal,
      status: 'completed',
    });

    const text =
      `🎉 <b>TERIMA KASIH ATAS DONASI ANDA!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>ID Donasi:</b> <code>${donation.id}</code>\n` +
      `<b>Donatur:</b> ${escapeHtml(donation.name)}\n` +
      `<b>Nominal:</b> ${formatCurrency(donation.nominal)}\n` +
      `<b>Waktu:</b> ${formatDate(donation.createdAt)}\n\n` +
      `Dukungan Anda sangat berarti bagi kelangsungan toko kami. Semoga rezeki Anda dilipatgandakan dan selalu diberi kesehatan! ❤️`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('📜 Lihat Riwayat Donasi Saya', 'donate_history')],
          [Markup.button.callback('🏠 Menu Utama', 'menu_main')],
        ],
      },
    };

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❤️ Terima kasih atas donasi Anda!').catch(() => {});
    }

    return safeEditOrReply(ctx, text, keyboard);
  } catch (err) {
    logger.error('Error confirming donation:', err.message);
    await ctx.reply('❌ Terjadi kesalahan saat mencatat donasi.', {
      reply_markup: { inline_keyboard: [navRow('menu_donate')] },
    });
  }
}

/**
 * Show User's Donation History
 * @param {object} ctx
 */
async function showDonationHistory(ctx) {
  const donations = donationService.getUserDonations(ctx.from.id);

  let text =
    `📜 <b>RIWAYAT DONASI SAYA</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n`;

  if (donations.length === 0) {
    text += `<i>Anda belum pernah melakukan donasi.</i>\n\nSilakan gunakan tombol di bawah ini untuk mendukung toko kami! 😊`;
  } else {
    const totalDonated = donations.reduce((sum, d) => sum + Number(d.nominal), 0);
    text += `<b>Total Donasi:</b> ${formatCurrency(totalDonated)} (${donations.length}x donasi)\n\n`;

    donations.forEach((d, index) => {
      text += `<b>${index + 1}. ${d.id}</b>\n`;
      text += `💰 Nominal: ${formatCurrency(d.nominal)}\n`;
      text += `Status: ${d.status === 'completed' ? '✅ Lunas' : '⏳ Pending'}\n`;
      text += `📅 Waktu: ${formatDate(d.createdAt)}\n\n`;
    });
  }

  const buttons = [
    [Markup.button.callback('🎁 Donasi Lagi', 'menu_donate')],
    navRow('menu_main'),
  ];

  return safeEditOrReply(ctx, text, { reply_markup: { inline_keyboard: buttons } });
}

function register(bot) {
  // Command /donasi
  bot.command('donasi', async (ctx) => {
    await showDonationMenu(ctx);
  });

  // Main donation menu callback
  bot.action('menu_donate', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await showDonationMenu(ctx);
  });

  // Preset action callback (donate_preset_5000, donate_preset_10000, etc)
  bot.action(/^donate_preset_(\d+)$/, async (ctx) => {
    const nominal = parseInt(ctx.match[1], 10);
    await handleGenerateQris(ctx, nominal);
  });

  // Custom nominal prompt callback
  bot.action('donate_custom', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await showCustomNominalPrompt(ctx);
  });

  // Check Mustika QRIS payment callback
  bot.action(/^donate_checkpay_(.+)$/, async (ctx) => {
    const refNo = ctx.match[1];
    await handleCheckDonationPayment(ctx, refNo);
  });

  // Confirm payment callback
  bot.action(/^donate_confirm_(\d+)$/, async (ctx) => {
    const nominal = parseInt(ctx.match[1], 10);
    await handleConfirmDonation(ctx, nominal);
  });

  // History action callback
  bot.action('donate_history', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await showDonationHistory(ctx);
  });
}

module.exports = {
  register,
  showDonationMenu,
  handleDonationInput,
};
