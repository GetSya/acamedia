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

// Emoji set untuk visual yang lebih baik
const EMOJI = {
    STORE: '🏪',
    PRODUCT: '📦',
    PRICE: '💰',
    STOCK: '📊',
    CATEGORY: '📁',
    CODE: '🏷️',
    ADMIN: '🧾',
    TIME: '⏰',
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    SEARCH: '🔍',
    TRASH: '🗑️',
    ADD: '➕',
    LIST: '📋',
    PAYMENT: '💳',
    QR: '📱',
    LOADING: '🔄',
    SAVE: '💾',
    USER: '👤',
    OWNER: '👑',
    BACK: '⬅️',
    NEXT: '➡️'
}

// --- SUPABASE LOGIC ---
const loadDB = async () => {
    try {
        console.log(`${EMOJI.LOADING} Mengambil data dari Supabase...`)
        
        const { data, error } = await supabase
            .from('master_data')
            .select('*')
            .eq('user_id', USER_ID)
        
        console.log(`${EMOJI.PRODUCT} Hasil query: ${data?.length || 0} baris`)
        
        if (error) {
            console.error(`${EMOJI.ERROR} Error loading:`, error)
            return []
        }
        
        if (!data || data.length === 0) {
            console.log(`${EMOJI.WARNING} Tidak ada data untuk user_id: ${USER_ID}`)
            return []
        }
        
        const daftarItem = data[0].daftar_item
        
        if (!daftarItem) {
            console.log(`${EMOJI.WARNING} daftar_item kosong`)
            return []
        }
        
        console.log(`${EMOJI.SUCCESS} Data loaded: ${daftarItem.length} items`)
        return daftarItem
        
    } catch (error) {
        console.error(`${EMOJI.ERROR} Error in loadDB:`, error)
        return []
    }
}

const saveDB = async (data) => {
    try {
        console.log(`${EMOJI.SAVE} Menyimpan data...`)
        
        const { error } = await supabase
            .from('master_data')
            .update({ 
                daftar_item: data,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', USER_ID)
        
        if (error) {
            console.error(`${EMOJI.ERROR} Error saving:`, error)
            return false
        }
        
        console.log(`${EMOJI.SUCCESS} Data saved: ${data.length} items`)
        return true
    } catch (error) {
        console.error(`${EMOJI.ERROR} Error in saveDB:`, error)
        return false
    }
}

// Format currency dengan emoji
const formatIDR = (num) => `${EMOJI.PRICE} Rp ${num.toLocaleString('id-ID')}`

// Generate final price dengan breakdown yang jelas
const getFinalPrice = (price) => {
    const tax = Math.ceil(price * SETTINGS.feePercent)
    const fee = SETTINGS.feeFixed
    const total = price + tax + fee
    
    return {
        base: price,
        tax: tax,
        fee: fee,
        total: Math.ceil(total),
        breakdown: {
            subtotal: price,
            taxPercent: (SETTINGS.feePercent * 100).toFixed(1),
            fixedFee: fee,
            total: Math.ceil(total)
        }
    }
}

// Fungsi untuk membuat box/border yang menarik
const createBox = (title, content, type = 'normal') => {
    const borders = {
        normal: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
        round: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
        thick: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' }
    }
    
    const border = borders[type]
    const width = 34
    const titleLine = ` ${title} `
    const padding = Math.max(0, width - titleLine.length)
    
    let box = `${border.tl}${border.h.repeat(width)}${border.tr}\n`
    box += `${border.v}${titleLine}${' '.repeat(padding)}${border.v}\n`
    box += `${border.v}${' '.repeat(width)}${border.v}\n`
    
    content.split('\n').forEach(line => {
        const lineContent = line.substring(0, width)
        const linePadding = ' '.repeat(Math.max(0, width - lineContent.length))
        box += `${border.v}${lineContent}${linePadding}${border.v}\n`
    })
    
    box += `${border.bl}${border.h.repeat(width)}${border.br}`
    
    return box
}

// Fungsi untuk membuat progress bar (stok indicator)
const createStockBar = (stock, maxStock = 100) => {
    const percentage = Math.min(100, Math.max(0, (stock / maxStock) * 100))
    const bars = 10
    const filled = Math.round((percentage / 100) * bars)
    const empty = bars - filled
    
    let bar = '['
    bar += '▓'.repeat(filled)
    bar += '░'.repeat(empty)
    bar += ']'
    
    let status = ''
    if (percentage >= 70) status = '🟢 Tersedia'
    else if (percentage >= 30) status = '🟡 Terbatas'
    else if (percentage > 0) status = '🔴 Hampir Habis'
    else status = '⚫ Habis'
    
    return `${bar} ${status} (${stock} pcs)`
}

// Fungsi untuk membuat tabel responsif
const createProductTable = (items, startIndex = 0, itemsPerPage = 8) => {
    const endIndex = Math.min(startIndex + itemsPerPage, items.length)
    const currentItems = items.slice(startIndex, endIndex)
    
    let table = ''
    currentItems.forEach((item, i) => {
        const globalIndex = startIndex + i
        const cost = getFinalPrice(item.harga_jual)
        const stockBar = createStockBar(item.stok)
        
        table += `┣ ${globalIndex + 1}. ${item.nama_barang}\n`
        table += `┃   ${EMOJI.PRICE} ${formatIDR(cost.total)}\n`
        table += `┃   ${EMOJI.STOCK} ${stockBar}\n`
        table += `┃   ${EMOJI.CATEGORY} ${item.kategori}\n`
        if (i < currentItems.length - 1) table += '┃\n'
    })
    
    return {
        table,
        hasNext: endIndex < items.length,
        hasPrev: startIndex > 0,
        currentPage: Math.floor(startIndex / itemsPerPage) + 1,
        totalPages: Math.ceil(items.length / itemsPerPage)
    }
}

let handler = async (m, { conn, text, command, usedPrefix, isOwner }) => {
    const db = await loadDB()
    
    // Log database status
    console.log(`${EMOJI.PRODUCT} Database: ${db.length} items`)
    
    const args = text.trim().split(/ +/)
    const subCommand = args[0] ? args[0].toLowerCase() : ''
    const pageNumber = parseInt(args[1]) || 1

    // ==========================================
    // LOGIKA OWNER (CRUD)
    // ==========================================
    if (subCommand === 'add' && isOwner) {
        if (!args[1]) {
            const helpText = createBox('TAMBAH PRODUK', 
                `Format: ${usedPrefix}store add nama|kategori|harga|stok|kode\n\n` +
                `Contoh: ${usedPrefix}store add Spotify Premium|Software|15000|50|SPOT001\n\n` +
                `${EMOJI.PRODUCT} Nama: Nama produk\n` +
                `${EMOJI.CATEGORY} Kategori: Software/Game/Pulsa\n` +
                `${EMOJI.PRICE} Harga: Angka saja (tanpa titik)\n` +
                `${EMOJI.STOCK} Stok: Jumlah stok\n` +
                `${EMOJI.CODE} Kode: Kode unik produk`, 'round')
            
            return m.reply(helpText)
        }
        
        const input = text.slice(4).split('|').map(v => v.trim())
        if (input.length < 5) {
            return m.reply(`${EMOJI.ERROR} Format tidak lengkap! Gunakan format:\n${usedPrefix}store add nama|kategori|harga|stok|kode`)
        }
        
        const [nama_barang, kategori, harga_jual, stok, kode_barang] = input
        
        const newItem = {
            id: `ITM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            nama_barang,
            kategori: kategori.toUpperCase(),
            harga_jual: parseInt(harga_jual.replace(/\D/g, '')) || 0,
            harga_beli: 0,
            stok: parseInt(stok.replace(/\D/g, '')) || 999,
            satuan: 'AKUN',
            tipe_harga: 'SINGLE',
            kode_barang: kode_barang.toUpperCase(),
            multi_units: [],
            created_at: new Date().toISOString()
        }
        
        db.push(newItem)
        const success = await saveDB(db)
        
        if (success) {
            const successBox = createBox('PRODUK DITAMBAHKAN', 
                `${EMOJI.PRODUCT} Nama: ${newItem.nama_barang}\n` +
                `${EMOJI.CATEGORY} Kategori: ${newItem.kategori}\n` +
                `${EMOJI.PRICE} Harga: ${formatIDR(newItem.harga_jual)}\n` +
                `${EMOJI.STOCK} Stok: ${newItem.stok}\n` +
                `${EMOJI.CODE} Kode: ${newItem.kode_barang}\n` +
                `${EMOJI.SUCCESS} Status: Berhasil disimpan!`, 'round')
            
            return m.reply(successBox)
        } else {
            return m.reply(`${EMOJI.ERROR} Gagal menyimpan produk!`)
        }
    }

    if (subCommand === 'del' && isOwner) {
        const index = parseInt(args[1]) - 1
        
        if (isNaN(index) || index < 0 || index >= db.length) {
            return m.reply(`${EMOJI.ERROR} Nomor tidak valid! Gunakan ${usedPrefix}store list untuk melihat daftar produk.`)
        }
        
        const removed = db[index]
        db.splice(index, 1)
        const success = await saveDB(db)
        
        if (success) {
            const deleteBox = createBox('PRODUK DIHAPUS',
                `${EMOJI.PRODUCT} ${removed.nama_barang}\n` +
                `${EMOJI.TRASH} Status: Berhasil dihapus!\n` +
                `📍 Sisa produk: ${db.length} items`, 'round')
            
            return m.reply(deleteBox)
        } else {
            return m.reply(`${EMOJI.ERROR} Gagal menghapus produk!`)
        }
    }

    if (subCommand === 'list' && isOwner) {
        if (db.length === 0) {
            return m.reply(`${EMOJI.WARNING} Database kosong! Tambah produk dengan ${usedPrefix}store add`)
        }
        
        const itemsPerPage = 5
        const currentPage = pageNumber
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = Math.min(startIndex + itemsPerPage, db.length)
        
        let listText = createBox(`DAFTAR PRODUK (${db.length} ITEMS)`, 
            `Halaman ${currentPage}/${Math.ceil(db.length / itemsPerPage)}\n` +
            `📊 Total Produk: ${db.length}\n` +
            `📈 Total Nilai: ${formatIDR(db.reduce((a, b) => a + (b.harga_jual * b.stok), 0))}\n`, 'normal')
        
        listText += '\n\n'
        
        db.slice(startIndex, endIndex).forEach((item, i) => {
            const globalIndex = startIndex + i + 1
            const cost = getFinalPrice(item.harga_jual)
            
            listText += `┏━━ ${globalIndex}. ${item.nama_barang}\n`
            listText += `┃ ${EMOJI.CODE} ${item.kode_barang} | ${EMOJI.CATEGORY} ${item.kategori}\n`
            listText += `┃ ${EMOJI.PRICE} ${formatIDR(item.harga_jual)} → ${formatIDR(cost.total)}\n`
            listText += `┃ ${createStockBar(item.stok)}\n`
            listText += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
        })
        
        if (db.length > itemsPerPage) {
            listText += `\n📄 Navigasi:\n`
            if (currentPage > 1) {
                listText += `${EMOJI.BACK} ${usedPrefix}store list ${currentPage - 1}\n`
            }
            if (endIndex < db.length) {
                listText += `${EMOJI.NEXT} ${usedPrefix}store list ${currentPage + 1}\n`
            }
        }
        
        listText += `\n${EMOJI.WARNING} Hapus: ${usedPrefix}store del [nomor]`
        
        return m.reply(listText)
    }

    // ==========================================
    // LOGIKA USER (PEMBAYARAN/BELI)
    // ==========================================
    if (command === 'beli') {
        if (!text) {
            return m.reply(`${EMOJI.WARNING} Format: ${usedPrefix}beli [nomor]\nContoh: ${usedPrefix}beli 1\n\n${EMOJI.SEARCH} Lihat produk: ${usedPrefix}store`)
        }
        
        const index = parseInt(args[0]) - 1
        const item = db[index]
        
        if (!item) {
            return m.reply(`${EMOJI.ERROR} Produk tidak ditemukan!\n\n${EMOJI.SEARCH} Cek daftar produk:\n${usedPrefix}store`)
        }
        
        if (item.stok <= 0) {
            return m.reply(`${EMOJI.ERROR} Stok habis!\n\n${EMOJI.PRODUCT} ${item.nama_barang}\n${EMOJI.WARNING} Stok: 0 pcs\n\nCek produk lain: ${usedPrefix}store`)
        }
        
        const cost = getFinalPrice(item.harga_jual)
        
        // Tampilkan konfirmasi pembelian
        const confirmBox = createBox('KONFIRMASI PEMBELIAN',
            `${EMOJI.PRODUCT} ${item.nama_barang}\n` +
            `${EMOJI.CODE} ${item.kode_barang}\n` +
            `${EMOJI.CATEGORY} ${item.kategori}\n\n` +
            `${EMOJI.PRICE} Harga: ${formatIDR(item.harga_jual)}\n` +
            `${EMOJI.ADMIN} Biaya Admin: ${formatIDR(cost.tax + cost.fee)}\n` +
            `┏━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
            `┃ ${EMOJI.PAYMENT} TOTAL: ${formatIDR(cost.total)} ┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
            `${createStockBar(item.stok)}\n\n` +
            `${EMOJI.WARNING} Lanjutkan pembelian? (YA/TIDAK)`, 'thick')
        
        await m.reply(confirmBox)
        
        // Simpan konteks pembelian untuk konfirmasi
        conn.purchase = conn.purchase || {}
        conn.purchase[m.sender] = {
            itemIndex: index,
            item: item,
            cost: cost,
            timestamp: Date.now()
        }
        
        return
    }

    // ==========================================
    // LOGIKA KONFIRMASI YA/TIDAK
    // ==========================================
    if ((text === 'YA' || text === 'ya') && conn.purchase && conn.purchase[m.sender]) {
        const purchaseData = conn.purchase[m.sender]
        const { itemIndex, item, cost } = purchaseData
        
        // Validasi timeout (5 menit)
        if (Date.now() - purchaseData.timestamp > 300000) {
            delete conn.purchase[m.sender]
            return m.reply(`${EMOJI.TIME} Sesi pembelian telah kadaluarsa!`)
        }
        
        delete conn.purchase[m.sender]
        
        await m.reply(`${EMOJI.LOADING} *Menyiapkan pembayaran...*`)
        
        try {
            const res = await createQris(cost.total, item.nama_barang)
            const exp = new Date(Date.now() + (SETTINGS.expired * 60000))
            
            const paymentBox = createBox('PEMBAYARAN QRIS',
                `${EMOJI.PRODUCT} ${item.nama_barang}\n` +
                `${EMOJI.CODE} ${item.kode_barang}\n\n` +
                `📋 Detail Biaya:\n` +
                `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                `┃ Subtotal : ${formatIDR(cost.base)}\n` +
                `┃ Admin QRIS: ${formatIDR(cost.tax + cost.fee)}\n` +
                `┃ ───────────────────────\n` +
                `┃ ${EMOJI.PAYMENT} TOTAL : ${formatIDR(cost.total)}\n` +
                `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                `${EMOJI.TIME} Berlaku hingga:\n` +
                `${exp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${SETTINGS.expired} menit)\n\n` +
                `${EMOJI.QR} *Scan QR Code di atas*\n` +
                `atau bayar ke nomor:\n` +
                `📱 ${res.payment_number}\n\n` +
                `${EMOJI.WARNING} *JANGAN TUTUP PESAN INI*`, 'normal')
            
            const msg = await conn.sendMessage(m.chat, {
                image: { 
                    url: `https://quickchart.io/qr?text=${encodeURIComponent(res.payment_number)}&size=300&margin=10`
                },
                caption: paymentBox
            }, { quoted: m })
            
            // Check status pembayaran
            let checkCount = 0
            const maxChecks = Math.floor((SETTINGS.expired * 60000) / 5000)
            
            const checkInterval = setInterval(async () => {
                checkCount++
                
                if (checkCount > maxChecks) {
                    clearInterval(checkInterval)
                    try {
                        await conn.sendMessage(m.chat, { delete: msg.key })
                        m.reply(`${EMOJI.TIME} Waktu pembayaran habis!`)
                    } catch (e) {}
                    return
                }
                
                const status = await checkStatus(res.order_id, cost.total)
                
                if (status && status.status === 'completed') {
                    clearInterval(checkInterval)
                    
                    try {
                        await conn.sendMessage(m.chat, { delete: msg.key })
                    } catch (e) {}
                    
                    // Update stok
                    item.stok = Math.max(0, item.stok - 1)
                    await saveDB(db)
                    
                    const successBox = createBox('PEMBAYARAN BERHASIL',
                        `${EMOJI.SUCCESS} *TRANSAKSI SUKSES!*\n\n` +
                        `${EMOJI.PRODUCT} ${item.nama_barang}\n` +
                        `${EMOJI.CODE} ${item.kode_barang}\n` +
                        `${EMOJI.PAYMENT} ${formatIDR(cost.total)}\n\n` +
                        `${EMOJI.STOCK} Stok tersisa: ${item.stok}\n` +
                        `${EMOJI.TIME} Waktu: ${new Date().toLocaleTimeString('id-ID')}\n\n` +
                        `${EMOJI.USER} *Hubungi admin untuk pengiriman produk*`, 'round')
                    
                    m.reply(successBox)
                }
            }, 5000)
            
            return
            
        } catch (e) {
            console.error('Payment error:', e)
            return m.reply(`${EMOJI.ERROR} *Gagal membuat pembayaran!*\n\nCoba beberapa saat lagi atau hubungi admin.`)
        }
    }
    
    if ((text === 'TIDAK' || text === 'tidak') && conn.purchase && conn.purchase[m.sender]) {
        delete conn.purchase[m.sender]
        return m.reply(`${EMOJI.BACK} Pembelian dibatalkan.\n\n${EMOJI.STORE} Lihat produk lain: ${usedPrefix}store`)
    }

    // ==========================================
    // LOGIKA PENCARIAN PRODUK
    // ==========================================
    if (subCommand && !['add', 'del', 'list', 'help'].includes(subCommand)) {
        // Pencarian berdasarkan nomor
        if (!isNaN(subCommand)) {
            const index = parseInt(subCommand) - 1
            const item = db[index]
            
            if (item) {
                const cost = getFinalPrice(item.harga_jual)
                const detailBox = createBox('DETAIL PRODUK',
                    `${EMOJI.PRODUCT} ${item.nama_barang}\n` +
                    `${EMOJI.CODE} ${item.kode_barang}\n` +
                    `${EMOJI.CATEGORY} ${item.kategori}\n\n` +
                    `📊 Stok: ${createStockBar(item.stok)}\n` +
                    `📦 Satuan: ${item.satuan}\n\n` +
                    `💰 Harga Detail:\n` +
                    `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                    `┃ Harga Pokok : ${formatIDR(item.harga_jual)}\n` +
                    `┃ Admin QRIS  : ${formatIDR(cost.tax + cost.fee)}\n` +
                    `┃ ───────────────────────\n` +
                    `┃ Total Bayar : ${formatIDR(cost.total)}\n` +
                    `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                    `${EMOJI.PAYMENT} *Beli produk ini:*\n` +
                    `🛒 ${usedPrefix}beli ${index + 1}\n\n` +
                    `${EMOJI.BACK} Kembali: ${usedPrefix}store`, 'round')
                
                return m.reply(detailBox)
            }
        } else {
            // Pencarian berdasarkan kata kunci
            const searchTerm = text.toLowerCase()
            const results = db.filter(item => 
                item.nama_barang.toLowerCase().includes(searchTerm) ||
                item.kode_barang.toLowerCase().includes(searchTerm) ||
                item.kategori.toLowerCase().includes(searchTerm)
            )
            
            if (results.length === 0) {
                return m.reply(`${EMOJI.SEARCH} *Pencarian: "${text}"*\n\n${EMOJI.WARNING} Tidak ditemukan!\n\nCoba cari dengan kata kunci lain atau lihat semua produk:\n${usedPrefix}store`)
            }
            
            if (results.length === 1) {
                const item = results[0]
                const cost = getFinalPrice(item.harga_jual)
                const detailBox = createBox('HASIL PENCARIAN',
                    `${EMOJI.SEARCH} Ditemukan 1 produk:\n\n` +
                    `${EMOJI.PRODUCT} ${item.nama_barang}\n` +
                    `${EMOJI.CODE} ${item.kode_barang}\n` +
                    `${EMOJI.CATEGORY} ${item.kategori}\n` +
                    `${EMOJI.PRICE} ${formatIDR(cost.total)}\n` +
                    `${createStockBar(item.stok)}\n\n` +
                    `${EMOJI.PAYMENT} *Beli:* ${usedPrefix}beli ${db.indexOf(item) + 1}`, 'round')
                
                return m.reply(detailBox)
            }
            
            let searchText = createBox(`HASIL PENCARIAN`,
                `${EMOJI.SEARCH} Kata kunci: "${text}"\n` +
                `📊 Ditemukan: ${results.length} produk\n\n`, 'normal')
            
            results.slice(0, 5).forEach((item, i) => {
                const globalIndex = db.indexOf(item) + 1
                const cost = getFinalPrice(item.harga_jual)
                
                searchText += `┣ ${globalIndex}. ${item.nama_barang}\n`
                searchText += `┃   ${EMOJI.PRICE} ${formatIDR(cost.total)} | ${EMOJI.STOCK} ${item.stok}pcs\n`
                searchText += `┃   ${EMOJI.PAYMENT} ${usedPrefix}beli ${globalIndex}\n`
                if (i < Math.min(5, results.length) - 1) searchText += '┃\n'
            })
            
            if (results.length > 5) {
                searchText += `\n${EMOJI.WARNING} Masih ada ${results.length - 5} produk lainnya.\nGunakan nomor lebih spesifik.`
            }
            
            searchText += `\n\n${EMOJI.BACK} Lihat semua: ${usedPrefix}store`
            
            return m.reply(searchText)
        }
    }

    // ==========================================
    // KATALOG UTAMA (STORE DEFAULT)
    // ==========================================
    if (db.length === 0) {
        const emptyStore = createBox('TOKO KOSONG',
            `${EMOJI.STORE} *ACAMEDIA STORE*\n\n` +
            `${EMOJI.WARNING} Belum ada produk tersedia.\n\n` +
            `${EMOJI.USER} Hubungi admin untuk info produk.\n` +
            `${EMOJI.OWNER} Admin: wa.me/628xxxxxx`, 'round')
        
        return m.reply(emptyStore)
    }
    
    // Pagination untuk katalog
    const itemsPerPage = 6
    const currentPage = pageNumber
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, db.length)
    
    // Group by kategori
    const categories = {}
    db.slice(startIndex, endIndex).forEach(item => {
        const cat = item.kategori || 'LAINNYA'
        if (!categories[cat]) categories[cat] = []
        categories[cat].push(item)
    })
    
    let storeText = createBox(`${EMOJI.STORE} ACAMEDIA STORE`,
        `📊 Total: ${db.length} produk\n` +
        `📈 Halaman: ${currentPage}/${Math.ceil(db.length / itemsPerPage)}\n` +
        `💰 Nilai toko: ${formatIDR(db.reduce((a, b) => a + (b.harga_jual * b.stok), 0))}\n`, 'normal')
    
    storeText += '\n'
    
    // Tampilkan produk per kategori
    for (const [category, items] of Object.entries(categories)) {
        storeText += `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`
        storeText += `┃ 📁 ${category.toUpperCase().padEnd(28)} ┃\n`
        storeText += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n`
        
        items.forEach((item, i) => {
            const globalIndex = db.indexOf(item) + 1
            const cost = getFinalPrice(item.harga_jual)
            const stockIndicator = item.stock > 10 ? '🟢' : item.stock > 0 ? '🟡' : '🔴'
            
            storeText += `┣ ${globalIndex}. ${item.nama_barang.substring(0, 25)}${item.nama_barang.length > 25 ? '...' : ''}\n`
            storeText += `┃   ${EMOJI.PRICE} ${formatIDR(cost.total)} ${stockIndicator} ${item.stok}pcs\n`
            storeText += `┃   ${EMOJI.PAYMENT} ${usedPrefix}beli ${globalIndex} | 📖 ${usedPrefix}store ${globalIndex}\n`
            if (i < items.length - 1) storeText += '┃\n'
        })
        
        storeText += '\n'
    }
    
    // Navigasi halaman
    if (db.length > itemsPerPage) {
        storeText += `┏━━━━━━━━━━ NAVIGASI ━━━━━━━━━━┓\n`
        if (currentPage > 1) {
            storeText += `┃ ${EMOJI.BACK} ${usedPrefix}store ${currentPage - 1}\n`
        }
        if (endIndex < db.length) {
            storeText += `┃ ${EMOJI.NEXT} ${usedPrefix}store ${currentPage + 1}\n`
        }
        storeText += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`
    }
    
    // Menu bantuan
    storeText += `${EMOJI.SEARCH} *CARA PEMBELIAN:*\n`
    storeText += `1. ${usedPrefix}store - Lihat produk\n`
    storeText += `2. ${usedPrefix}store [nomor] - Detail produk\n`
    storeText += `3. ${usedPrefix}beli [nomor] - Beli produk\n`
    storeText += `4. ${usedPrefix}store [nama] - Cari produk\n\n`
    
    storeText += `${EMOJI.WARNING} *CATATAN:*\n`
    storeText += `• Pembayaran via QRIS\n`
    storeText += `• Waktu pembayaran: ${SETTINGS.expired} menit\n`
    storeText += `• Stok dapat berubah setiap saat\n\n`
    
    if (isOwner) {
        storeText += `${EMOJI.OWNER} *MENU ADMIN:*\n`
        storeText += `• ${usedPrefix}store add - Tambah produk\n`
        storeText += `• ${usedPrefix}store del [nomor] - Hapus produk\n`
        storeText += `• ${usedPrefix}store list - Daftar produk\n`
    }
    
    return m.reply(storeText)
}

// --- API PAKASIR ---
async function createQris(amount, name) {
    try {
        const res = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
            project: SETTINGS.slug,
            order_id: `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            amount: parseInt(amount),
            api_key: SETTINGS.apikey,
            product_name: name.substring(0, 50)
        }, { 
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'AcamediaStore/1.0'
            },
            timeout: 10000
        })
        return res.data.payment
    } catch (error) {
        console.error(`${EMOJI.ERROR} Create QRIS Error:`, error.message)
        throw error
    }
}

async function checkStatus(id, amt) {
    try {
        const res = await axios.get(`https://app.pakasir.com/api/transactiondetail`, {
            params: {
                project: SETTINGS.slug,
                amount: amt,
                order_id: id,
                api_key: SETTINGS.apikey
            },
            timeout: 5000
        })
        return res.data.transaction
    } catch (error) {
        console.error(`${EMOJI.ERROR} Check Status Error:`, error.message)
        return null
    }
}

// Command help
handler.help = [
    'store [halaman/nomor/cari]',
    'beli [nomor]',
    'store add [nama|kategori|harga|stok|kode] (owner)',
    'store del [nomor] (owner)',
    'store list [halaman] (owner)'
]

handler.tags = ['shop', 'payment', 'store']
handler.command = /^(store|toko|beli|menu|start|help|produk|shop)$/i

export default handler
