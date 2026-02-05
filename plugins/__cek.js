import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

// --- SUPABASE CONFIG ---
const SUPABASE_URL = 'https://xteposmfavnnevgqivub.supabase.co'
const SUPABASE_KEY = 'sb_publishable__iD2NyZNQa7HVnreBtYuow__aHIr6ie'
const USER_ID = 'ff1c94f7-b70b-4ae4-aaf1-d02227638ef2'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- GLOBAL SETTINGS ---
const SETTINGS = {
    slug: 'acamedia',
    apikey: 'ZU0JBrZtUZSqI8nAqz73zbtgJFtj0tY5',
    expired: 10,
    feePercent: 0.007,
    feeFixed: 310
}

// --- DESIGN CONFIG ---
const DESIGN = {
    colors: {
        primary: '🟪',
        secondary: '🟦',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        info: 'ℹ️',
        money: '💎'
    },
    borders: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
        middleLeft: '├',
        middleRight: '┤',
        middleTop: '┬',
        middleBottom: '┴',
        cross: '┼'
    },
    icons: {
        store: '🏪',
        product: '📦',
        category: '📁',
        price: '💰',
        stock: '📊',
        code: '🏷️',
        admin: '🧾',
        time: '⏰',
        payment: '💳',
        qris: '📱',
        user: '👤',
        owner: '🛠️',
        search: '🔍',
        cart: '🛒',
        database: '🗄️',
        list: '📋',
        add: '➕',
        delete: '🗑️',
        home: '🏠'
    }
}

// --- SUPABASE LOGIC ---
const loadDB = async () => {
    try {
        console.log(`${DESIGN.icons.database} Loading data from Supabase...`)
        
        const { data, error } = await supabase
            .from('master_data')
            .select('*')
            .eq('user_id', USER_ID)
        
        console.log(`${DESIGN.colors.info} Query result: ${data?.length || 0} rows`)
        
        if (error) {
            console.error(`${DESIGN.colors.error} Supabase error:`, error)
            return []
        }
        
        if (!data || data.length === 0) {
            console.log(`${DESIGN.colors.warning} No data for user_id: ${USER_ID}`)
            return []
        }
        
        const daftarItem = data[0].daftar_item
        
        if (!daftarItem) {
            console.log(`${DESIGN.colors.warning} daftar_item is empty`)
            return []
        }
        
        console.log(`${DESIGN.colors.success} Data loaded: ${daftarItem.length} items`)
        return daftarItem
        
    } catch (error) {
        console.error(`${DESIGN.colors.error} LoadDB error:`, error)
        return []
    }
}

const saveDB = async (data) => {
    try {
        console.log(`${DESIGN.icons.database} Saving data to Supabase...`)
        
        const { error } = await supabase
            .from('master_data')
            .update({ 
                daftar_item: data,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', USER_ID)
        
        if (error) {
            console.error(`${DESIGN.colors.error} Save error:`, error)
            return false
        }
        
        console.log(`${DESIGN.colors.success} Data saved: ${data.length} items`)
        return true
    } catch (error) {
        console.error(`${DESIGN.colors.error} SaveDB error:`, error)
        return false
    }
}

// --- FORMATTING FUNCTIONS ---
const getFinalPrice = (price) => {
    let tax = price * SETTINGS.feePercent
    let total = price + tax + SETTINGS.feeFixed
    return {
        base: price,
        tax: Math.ceil(tax + SETTINGS.feeFixed),
        total: Math.ceil(total)
    }
}

const formatIDR = (num) => 'Rp' + num.toLocaleString('id-ID')

const createHeader = (title, subtitle = '') => {
    const width = 40
    const titleLine = ` ${title} `.padStart((width - title.length) / 2 + title.length, '═').padEnd(width, '═')
    
    let header = `╔${'═'.repeat(width)}╗\n`
    header += `║${' '.repeat(width)}║\n`
    header += `║${titleLine}║\n`
    if (subtitle) {
        const subtitleLine = ` ${subtitle} `.padStart((width - subtitle.length) / 2 + subtitle.length, ' ').padEnd(width, ' ')
        header += `║${subtitleLine}║\n`
    }
    header += `║${' '.repeat(width)}║\n`
    header += `╚${'═'.repeat(width)}╝`
    
    return header
}

const createSection = (title, content, icon = '') => {
    const section = `${icon ? `${icon} ` : ''}*${title}*\n${content}\n`
    return section
}

const createProductCard = (item, index, showDetail = false) => {
    const cost = getFinalPrice(item.harga_jual)
    
    if (showDetail) {
        return `┌──────────────────────────────┐
│ ${DESIGN.icons.product} *${item.nama_barang}*
├──────────────────────────────┤
│ ${DESIGN.icons.category} Kategori: ${item.kategori}
│ ${DESIGN.icons.code} Kode: ${item.kode_barang}
│ ${DESIGN.icons.stock} Stok: ${item.stok} ${item.satuan}
├──────────────────────────────┤
│ ${DESIGN.icons.price} Harga: ${formatIDR(item.harga_jual)}
│ ${DESIGN.icons.admin} Admin: ${formatIDR(cost.tax)}
│ ${DESIGN.colors.money} *TOTAL: ${formatIDR(cost.total)}*
└──────────────────────────────┘
${DESIGN.icons.cart} *Beli:* \`.beli ${index + 1}\``
    }
    
    return `${index + 1}. ${DESIGN.icons.product} ${item.nama_barang}
   ${DESIGN.icons.price} ${formatIDR(cost.total)} │ ${DESIGN.icons.stock} ${item.stok}`
}

const createPaymentBox = (item, cost) => {
    const exp = new Date(Date.now() + (SETTINGS.expired * 60000))
    
    return `╔══════════════════════════════╗
║     ${DESIGN.icons.payment} *PEMBAYARAN*     ║
╠══════════════════════════════╣
║ ${DESIGN.icons.product} Produk: ${item.nama_barang}
║ ${DESIGN.icons.code} Kode: ${item.kode_barang}
╠══════════════════════════════╣
║ ${DESIGN.icons.price} Harga: ${formatIDR(cost.base)}
║ ${DESIGN.icons.admin} Admin: ${formatIDR(cost.tax)}
╠══════════════════════════════╣
║ ${DESIGN.colors.money} *TOTAL: ${formatIDR(cost.total)}*
║ ${DESIGN.icons.time} Berlaku: ${exp.toLocaleTimeString('id-ID')}
╚══════════════════════════════╝`
}

// --- MAIN HANDLER ---
let handler = async (m, { conn, text, command, usedPrefix, isOwner }) => {
    let db = await loadDB()
    
    let args = text.trim().split(/ +/)
    let subCommand = args[0] ? args[0].toLowerCase() : ''

    // ==========================================
    // OWNER COMMANDS (CRUD)
    // ==========================================
    if (subCommand === 'add' && isOwner) {
        let input = text.split('add')[1]?.split('|').map(v => v.trim())
        if (!input || input.length < 5) {
            const helpText = `${createHeader('TAMBAH PRODUK', 'Owner Only')}

${DESIGN.icons.add} *Format:*
\`${usedPrefix}store add nama|kategori|harga|stok|kode\`

${DESIGN.colors.info} *Contoh:*
\`${usedPrefix}store add Spotify Premium 30 Hari|SOFTWARE|10000|999|SPOT001\`

${DESIGN.icons.owner} *Kolom yang diperlukan:*
• Nama Produk
• Kategori
• Harga Jual (angka)
• Stok (angka)
• Kode Produk`
            return m.reply(helpText)
        }
        
        let [nama_barang, kategori, harga_jual, stok, kode_barang] = input
        
        const newItem = {
            id: `ITM-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substr(2, 4)}`,
            nama_barang: nama_barang,
            kategori: kategori || 'SOFTWARE',
            harga_jual: parseInt(harga_jual.replace(/\D/g, '')) || 0,
            harga_beli: 0,
            stok: parseInt(stok.replace(/\D/g, '')) || 999,
            satuan: 'AKUN',
            tipe_harga: 'SINGLE',
            kode_barang: kode_barang || `ITM-${Date.now().toString().slice(-6)}`,
            multi_units: []
        }
        
        db.push(newItem)
        const success = await saveDB(db)
        
        if (success) {
            const successMsg = `${DESIGN.colors.success} *PRODUK DITAMBAHKAN*

${createProductCard(newItem, db.length - 1, true)}

${DESIGN.icons.database} Data berhasil disimpan ke database`
            return m.reply(successMsg)
        } else {
            return m.reply(`${DESIGN.colors.error} Gagal menyimpan produk ke database`)
        }
    }

    if (subCommand === 'del' && isOwner) {
        let index = parseInt(args[1]) - 1
        if (index >= 0 && db[index]) {
            let removed = db.splice(index, 1)
            const success = await saveDB(db)
            if (success) {
                return m.reply(`${DESIGN.icons.delete} *Produk Dihapus*\n"${removed[0].nama_barang}" telah dihapus dari database`)
            } else {
                return m.reply(`${DESIGN.colors.error} Gagal menghapus produk`)
            }
        }
        return m.reply(`${DESIGN.colors.error} Nomor produk tidak ditemukan`)
    }

    if (subCommand === 'list' && isOwner) {
        if (db.length === 0) return m.reply(`${DESIGN.colors.warning} Database kosong`)
        
        let listText = `${createHeader('DAFTAR PRODUK', `Total: ${db.length} item`)}

${DESIGN.icons.list} *Semua Produk:*\n`
        
        db.forEach((item, i) => {
            listText += `\n${i + 1}. ${item.nama_barang}`
            listText += `\n   ${DESIGN.icons.category} ${item.kategori} | ${DESIGN.icons.price} ${formatIDR(item.harga_jual)}`
            listText += `\n   ${DESIGN.icons.stock} ${item.stok} ${item.satuan} | ${DESIGN.icons.code} ${item.kode_barang}`
            listText += `\n   ──────────────────────`
        })
        
        return m.reply(listText)
    }

    // ==========================================
    // USER COMMANDS (PURCHASE)
    // ==========================================
    if (command === 'beli') {
        let index = parseInt(args[0]) - 1
        let item = db[index]
        
        if (!item) {
            const notFound = `${DESIGN.colors.error} *Produk Tidak Ditemukan*

${DESIGN.icons.search} Pilih produk: \`.beli [nomor]\`
${DESIGN.icons.home} Lihat katalog: \`.store\`

${DESIGN.colors.info} Contoh: \`.beli 1\``
            return m.reply(notFound)
        }

        if (item.stok <= 0) {
            return m.reply(`${DESIGN.colors.error} *STOK HABIS*\n\nMaaf, stok "${item.nama_barang}" sedang kosong.`)
        }
        
        let cost = getFinalPrice(item.harga_jual)
        
        await m.reply(`${DESIGN.icons.qris} *Menyiapkan QRIS...*`)

        try {
            const res = await createQris(cost.total, item.nama_barang)
            
            const paymentBox = createPaymentBox(item, cost)
            const caption = `${paymentBox}\n\n${DESIGN.icons.qris} *Scan QR Code di atas untuk pembayaran*\n${DESIGN.icons.time} QR akan kadaluarsa dalam ${SETTINGS.expired} menit`

            let msg = await conn.sendMessage(m.chat, { 
                image: { url: `https://quickchart.io/qr?text=${encodeURIComponent(res.payment_number)}&size=300&margin=2` },
                caption: caption
            }, { quoted: m })

            // Check Status
            let check = setInterval(async () => {
                if (Date.now() > new Date(Date.now() + (SETTINGS.expired * 60000))) {
                    clearInterval(check)
                    try {
                        await conn.sendMessage(m.chat, { delete: msg.key })
                    } catch (e) {}
                    return
                }
                
                let status = await checkStatus(res.order_id, cost.total)
                if (status && status.status === 'completed') {
                    clearInterval(check)
                    try {
                        await conn.sendMessage(m.chat, { delete: msg.key })
                    } catch (e) {}
                    
                    // Update stock
                    item.stok = Math.max(0, item.stok - 1)
                    await saveDB(db)
                    
                    const successMsg = `${DESIGN.colors.success} *PEMBAYARAN BERHASIL!*

╔══════════════════════════════╗
║     🎉 TRANSAKSI SUKSES     ║
╠══════════════════════════════╣
║ ${DESIGN.icons.product} ${item.nama_barang}
║ ${DESIGN.icons.code} ${item.kode_barang}
╠══════════════════════════════╣
║ ${DESIGN.icons.price} Dibayar: ${formatIDR(cost.total)}
║ ${DESIGN.icons.stock} Stok tersisa: ${item.stok}
╚══════════════════════════════╝

${DESIGN.colors.info} Silakan hubungi admin untuk pengiriman produk.`
                    m.reply(successMsg)
                }
            }, 7000)
            return
        } catch (e) { 
            console.error('Payment error:', e)
            return m.reply(`${DESIGN.colors.error} *Sistem Pembayaran Error*\n\nSilakan coba beberapa saat lagi atau hubungi admin.`) 
        }
    }

    // ==========================================
    // SEARCH & DETAIL
    // ==========================================
    if (subCommand && subCommand !== 'add' && subCommand !== 'del' && subCommand !== 'list') {
        let item
        if (!isNaN(subCommand)) {
            item = db[parseInt(subCommand) - 1]
        } else {
            item = db.find(v => 
                v.nama_barang.toLowerCase().includes(subCommand) ||
                v.kode_barang.toLowerCase().includes(subCommand)
            )
        }

        if (item) {
            const detailText = `${createProductCard(item, db.indexOf(item), true)}`
            return m.reply(detailText)
        }
    }

    // ==========================================
    // MAIN CATALOG
    // ==========================================
    if (db.length === 0) {
        const emptyStore = `${createHeader('ACAMEDIA STORE', 'Coming Soon')}

${DESIGN.colors.warning} *TOKO SEDANG KOSONG*

${DESIGN.colors.info} Belum ada produk yang tersedia.
Silakan hubungi admin untuk info lebih lanjut.

${DESIGN.icons.owner} *Kontak Admin:* 
• Owner Bot`
        return m.reply(emptyStore)
    }
    
    // Group by category
    let sections = {}
    db.forEach((item, i) => {
        const kategori = item.kategori || 'UMUM'
        if (!sections[kategori]) sections[kategori] = []
        sections[kategori].push(createProductCard(item, i, false))
    })

    let catalogText = `${createHeader('ACAMEDIA STORE', 'Digital Products')}

${DESIGN.icons.store} *Katalog Produk*\n`

    Object.keys(sections).forEach(category => {
        catalogText += `\n${DESIGN.icons.category} *${category.toUpperCase()}*\n`
        catalogText += `${DESIGN.borders.middleLeft}${DESIGN.borders.horizontal.repeat(30)}${DESIGN.borders.middleRight}\n`
        catalogText += sections[category].join('\n')
        catalogText += '\n\n'
    })

    catalogText += `${DESIGN.borders.bottomLeft}${DESIGN.borders.horizontal.repeat(32)}${DESIGN.borders.bottomRight}\n`
    catalogText += `📊 Total: ${db.length} produk tersedia\n\n`
    
    catalogText += `${DESIGN.icons.search} *CARA MENGGUNAKAN:*\n`
    catalogText += `• \`.store [nomor]\` - Lihat detail produk\n`
    catalogText += `• \`.store [nama]\` - Cari produk\n`
    catalogText += `• \`.beli [nomor]\` - Beli produk\n`
    catalogText += `• \`.store\` - Tampilkan katalog ini\n`

    if (isOwner) {
        catalogText += `\n${DESIGN.icons.owner} *MENU ADMIN:*\n`
        catalogText += `• \`.store add\` - Tambah produk\n`
        catalogText += `• \`.store del [nomor]\` - Hapus produk\n`
        catalogText += `• \`.store list\` - Daftar semua produk\n`
    }

    return m.reply(catalogText)
}

// --- API FUNCTIONS ---
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
    } catch (e) {
        console.error('Error checking status:', e)
        return null
    }
}

handler.help = ['store', 'beli']
handler.tags = ['shop']
handler.command = /^(store|toko|beli|menu|start|help)$/i

export default handler
