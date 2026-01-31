let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    // Database sesi percakapan (sederhana) agar owner bisa membalas dengan mudah
    conn.support = conn.support ? conn.support : {}

    // --- 1. LOGIKA UNTUK USER (Kirim pesan ke Owner) ---
    if (!isOwner) {
        if (!text) return m.reply(`*Format Salah!*\nKetik: ${usedPrefix + command} [Pesan Kamu]\n\nContoh: ${usedPrefix + command} Halo admin, saya mau tanya stok...`)
        
        let id = m.sender
        let nama = m.name
        let teks_ke_owner = `⚠️ *HUBUNGI OWNER*\n\n` +
                            ` dari: @${id.split('@')[0]}\n` +
                            ` Nama: ${nama}\n` +
                            ` Pesan: _"${text}"_\n\n` +
                            `*Ketik:* \`.ans ${id.split('@')[0]} [balasan]\` untuk membalas\n` +
                            `*Atau:* Reply pesan ini langsung.`

        // Kirim ke nomor owner (pastikan nomor owner terdaftar di config)
        let ownerId = global.owner[0] + '@s.whatsapp.net' 
        await conn.reply(ownerId, teks_ke_owner, null, { mentions: [id] })
        
        m.reply('✅ Pesan Anda telah dikirim ke Owner. Mohon tunggu balasannya.')
    }

    // --- 2. LOGIKA UNTUK OWNER (Balas ke User) ---
    if (isOwner) {
        let [user_id, ...pesan] = text.split(' ')
        if (!user_id || pesan.length === 0) return m.reply(`*Cara membalas:*\n${usedPrefix + command} [JID/Nomor] [Pesan]`)

        let target = user_id.includes('@') ? user_id : user_id + '@s.whatsapp.net'
        let teks_balasan = `💬 *PESAN DARI OWNER*\n\n` +
                           `"${pesan.join(' ')}"\n\n` +
                           `_Balas kembali dengan .hubungi untuk merespon._`

        try {
            await conn.reply(target, teks_balasan, null)
            m.reply('✅ Balasan terkirim ke User.')
        } catch (e) {
            m.reply('❌ Gagal mengirim balasan. User mungkin memblokir bot.')
        }
    }
}

// Command untuk user (.hubungi) dan owner (.ans / answer)
handler.command = /^(hubungi|chat|owner|ans|balas)$/i
// FITUR REPLI OTOMATIS (OWNER)
handler.before = async (m, { conn, isOwner }) => {
    if (!isOwner || !m.quoted || !m.quoted.text || !m.quoted.text.includes('HUBUNGI OWNER')) return
    
    // Mengambil nomor user dari teks quote menggunakan Regex
    let userJID = m.quoted.text.split('@')[1].split(' ')[0] + '@s.whatsapp.net'
    let balasan = m.text
    
    let teks_balasan = `💬 *PESAN DARI OWNER*\n\n` +
                       `"${balasan}"\n\n` +
                       `_Balas kembali dengan .hubungi untuk merespon._`
                       
    await conn.reply(userJID, teks_balasan, null)
    m.reply(`✅ Pesan berhasil dibalas ke user tersebut.`)
    return true
}
handler.help = ['hubungi', 'ans']
handler.tags = ['info']

export default handler