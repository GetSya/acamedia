import fs from 'fs'
import path from 'path'
import axios from 'axios'

// --- GLOBAL SETTINGS ---
const SETTINGS = {
    slug: 'acamedia',
    apikey: 'ZU0JBrZtUZSqI8nAqz73zbtgJFtj0tY5',
    expired: 10,
    feePercent: 0.007, // 0.7%
    feeFixed: 310,    // Rp 310
    jsonPath: path.join(process.cwd(), 'json', 'storekuh.json')
}

// --- UTILITY LOGIC ---
const loadDB = () => {
    try {
        if (!fs.existsSync(SETTINGS.jsonPath)) return []
        return JSON.parse(fs.readFileSync(SETTINGS.jsonPath, 'utf-8'))
    } catch { return [] }
}

const saveDB = (data) => fs.writeFileSync(SETTINGS.jsonPath, JSON.stringify(data, null, 2))

// Rumus hitung biaya admin QRIS
const getFinalPrice = (price) => {
    let tax = price * SETTINGS.feePercent
    let total = price + tax + SETTINGS.feeFixed
    return {
        base: price,
        tax: Math.ceil(tax + SETTINGS.feeFixed),
        total: Math.ceil(total)
    }
}

const formatIDR = (num) => 'Rp ' + num.toLocaleString('id-ID')

let handler = async (m, { conn, text, command, usedPrefix, isOwner }) => {
    let db = loadDB()
    let args = text.trim().split(/ +/)
    let subCommand = args[0] ? args[0].toLowerCase() : ''

    // ==========================================
    // LOGIKA OWNER (CRUD)
    // ==========================================
    if (subCommand === 'add' && isOwner) {
        let input = text.split('add')[1]?.split('|').map(v => v.trim())
        if (!input || input.length < 6) return m.reply(`*Format Owner (Add):*\n${usedPrefix}store add Nama|Kategori|Deskripsi|Harga|Promo(Kosongkan jika tak ada)|Durasi|Varian`)
        
        let [nama, kategori, deskripsi, harga, promo, durasi, varian] = input
        db.push({
            id: Date.now(),
            nama, kategori, deskripsi, 
            harga: parseInt(harga.replace(/\D/g, '')),
            promo: promo ? parseInt(promo.replace(/\D/g, '')) : 0,
            durasi, varian
        })
        saveDB(db)
        return m.reply(`✨ *Produk "${nama}" Berhasil Disimpan!*`)
    }

    if (subCommand === 'del' && isOwner) {
        let index = parseInt(args[1]) - 1
        if (db[index]) {
            let removed = db.splice(index, 1)
            saveDB(db)
            return m.reply(`🗑️ *"${removed[0].nama}" berhasil dihapus.*`)
        }
        return m.reply('❌ Nomor produk tidak ditemukan.')
    }

    // ==========================================
    // LOGIKA USER (PEMBAYARAN/BELI)
    // ==========================================
    if (command === 'beli' || subCommand === 'buy') {
        let index = parseInt(command === 'beli' ? args[0] : args[1]) - 1
        let item = db[index]
        if (!item) return m.reply(`*Pilih produk:* .beli 1`)

        let hrg = item.promo > 0 ? item.promo : item.harga
        let cost = getFinalPrice(hrg)
        
        await m.reply('🔄 *Menyiapkan QRIS Aktif...*')

        try {
            const res = await createQris(cost.total, item.nama)
            let exp = new Date(Date.now() + (SETTINGS.expired * 60000))

            let caption = `┌───〔 *PEMBAYARAN* 〕───\n`
            caption += `│ 📦 *Item:* ${item.nama}\n`
            caption += `│ 💰 *Harga:* ${formatIDR(cost.base)}\n`
            caption += `│ 🧾 *Biaya Admin:* ${formatIDR(cost.tax)}\n`
            caption += `│ 📉 *Promo:* ${item.promo > 0 ? 'Aktif' : 'Tidak'}\n`
            caption += `├─────────────────\n`
            caption += `│ 🏦 *Total:* *${formatIDR(cost.total)}*\n`
            caption += `│ 🕒 *Valid S/D:* ${exp.toLocaleTimeString()}\n`
            caption += `└─────────────────\n\n`
            caption += `📱 *Scan QR di atas untuk checkout.*\n_Pembayaran otomatis diproses bot._`

            let msg = await conn.sendMessage(m.chat, { 
                image: { url: `https://quickchart.io/qr?text=${encodeURIComponent(res.payment_number)}` },
                caption: caption
            }, { quoted: m })

            // Check Status Logic (7 Sec Interval)
            let check = setInterval(async () => {
                if (Date.now() > exp) {
                    clearInterval(check)
                    await conn.sendMessage(m.chat, { delete: msg.key })
                    return
                }
                let status = await checkStatus(res.order_id, cost.total)
                if (status && status.status === 'completed') {
                    clearInterval(check)
                    await conn.sendMessage(m.chat, { delete: msg.key })
                    m.reply(`✅ *ORDER SUKSES!*\n\nPembayaran untuk *${item.nama}* senilai *${formatIDR(cost.total)}* telah kami terima.\n\n_Mohon hubungi Owner segera._`)
                }
            }, 7000)
            return
        } catch (e) { return m.reply('❌ Sistem Payment sedang maintenance.') }
    }

    // ==========================================
    // LOGIKA NAVIGATION (STORE & DETAIL)
    // ==========================================
    
    // Logika Pintar: Jika ketik ".store 1" atau ".store netflix"
    if (subCommand && subCommand !== 'add' && subCommand !== 'del') {
        let item
        if (!isNaN(subCommand)) {
            item = db[parseInt(subCommand) - 1] // Berdasarkan Angka
        } else {
            item = db.find(v => v.nama.toLowerCase().includes(subCommand)) // Berdasarkan Pencarian Kata
        }

        if (item) {
            let p = getFinalPrice(item.promo > 0 ? item.promo : item.harga)
            let textDetail = `🔖 *INFO PRODUK*\n\n`
            textDetail += `🏷️ *${item.nama}*\n`
            textDetail += `📦 *Kategori:* ${item.kategori}\n`
            textDetail += `⏳ *Durasi:* ${item.durasi}\n`
            textDetail += `📋 *Varian:* ${item.varian}\n\n`
            textDetail += `📝 *Keterangan:* \n${item.deskripsi}\n\n`
            textDetail += `💰 *TOTAL BAYAR:* *${formatIDR(p.total)}*\n`
            textDetail += `_(Termasuk PPN & Admin)_\n\n`
            textDetail += `🛒 Ketik *.beli ${db.indexOf(item) + 1}*`
            return m.reply(textDetail)
        }
    }

    // CATALOG UTAMA
    if (db.length === 0) return m.reply('Toko sedang tutup atau tidak ada barang.')
    
    let sections = {}
    db.forEach((v, i) => {
        if (!sections[v.kategori]) sections[v.kategori] = []
        let p = getFinalPrice(v.promo > 0 ? v.promo : v.harga)
        sections[v.kategori].push(`│ ${i + 1}. ${v.nama} \n│    ╰ ${formatIDR(p.total)}`)
    })

    let menuToko = `🏪 *WELCOME TO ACAMEDIA*\n\n`
    for (let kat in sections) {
        menuToko += `┏──『 *${kat.toUpperCase()}* 』\n`
        menuToko += sections[kat].join('\n')
        menuToko += `\n┗───────────────\n\n`
    }
    menuToko += `👉 Ketik *.store [nomor]* untuk detail\n`
    menuToko += `👉 Ketik *.beli [nomor]* untuk checkout`

    if (isOwner) menuToko += `\n\n🛠️ *Admin:* \`.store add\` | \`.store del 1\``

    m.reply(menuToko)
}

// --- API PAKASIR HELPERS ---
async function createQris(amount, name) {
    const res = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
        project: SETTINGS.slug,
        order_id: 'QR-' + Date.now(),
        amount: parseInt(amount),
        api_key: SETTINGS.apikey,
    }, { headers: { 'Content-Type': 'application/json' } })
    return res.data.payment
}

async function checkStatus(id, amt) {
    try {
        const res = await axios.get(`https://app.pakasir.com/api/transactiondetail?project=${SETTINGS.slug}&amount=${amt}&order_id=${id}&api_key=${SETTINGS.apikey}`)
        return res.data.transaction
    } catch { return null }
}

handler.help = ['store', 'beli']
handler.tags = ['shop']
handler.command = /^(store|toko|beli|menu|start|help)$/i

export default handler