import axios from 'axios'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

// --- SUPABASE LOGIC ---
const loadDB = async () => {
    try {
        console.log('Mengambil data dari Supabase...')
        
        const { data, error } = await supabase
            .from('master_data')
            .select('*')
            .eq('user_id', USER_ID)
        
        console.log('Hasil query:', data?.length || 0, 'baris')
        
        if (error) {
            console.error('Error loading:', error)
            return []
        }
        
        if (!data || data.length === 0) {
            console.log('Tidak ada data untuk user_id:', USER_ID)
            return []
        }
        
        const daftarItem = data[0].daftar_item
        
        if (!daftarItem) {
            console.log('daftar_item kosong')
            return []
        }
        
        console.log('Data loaded:', daftarItem.length, 'items')
        return daftarItem
        
    } catch (error) {
        console.error('Error in loadDB:', error)
        return []
    }
}

const saveDB = async (data) => {
    try {
        console.log('Menyimpan data...')
        
        const { error } = await supabase
            .from('master_data')
            .update({ 
                daftar_item: data,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', USER_ID)
        
        if (error) {
            console.error('Error saving:', error)
            return false
        }
        
        console.log('Data saved:', data.length, 'items')
        return true
    } catch (error) {
        console.error('Error in saveDB:', error)
        return false
    }
}

// Format currency sederhana
const formatIDR = (num) => `Rp ${num.toLocaleString('id-ID')}`

// Generate final price
const getFinalPrice = (price) => {
    const tax = Math.ceil(price * SETTINGS.feePercent)
    const fee = SETTINGS.feeFixed
    const total = price + tax + fee
    
    return {
        base: price,
        tax: tax,
        fee: fee,
        total: Math.ceil(total)
    }
}

// Fungsi untuk membuat QR code URL dengan api.qrserver.com
const generateQRCodeUrl = (paymentNumber) => {
    const encodedData = encodeURIComponent(paymentNumber)
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodedData}&size=300x300&ecc=H&color=000000&bgcolor=ffffff&margin=10&qzone=4`
}

// Fungsi untuk membuat daftar produk ringkas
const createCompactProductList = (items) => {
    let productList = ''
    
    // Kelompokkan berdasarkan kategori
    const categories = {}
    items.forEach((item, index) => {
        const category = item.kategori || 'LAINNYA'
        if (!categories[category]) categories[category] = []
        
        const cost = getFinalPrice(item.harga_jual)
        const productLine = `${index + 1}. ${item.nama_barang}`
        const priceLine = `   ${formatIDR(cost.total)} | Stok: ${item.stok}`
        
        categories[category].push(`${productLine}\n${priceLine}`)
    })
    
    // Tampilkan semua kategori dan produk
    Object.keys(categories).forEach(category => {
        productList += `\n【 ${category.toUpperCase()} 】\n`
        productList += '─'.repeat(35) + '\n'
        productList += categories[category].join('\n\n')
        productList += '\n\n'
    })
    
    return productList
}

// Fungsi untuk detail produk
const showProductDetail = (item, index, db) => {
    const cost = getFinalPrice(item.harga_jual)
    
    let detail = '══════════════════════════════════\n'
    detail += `PRODUK DETAIL\n`
    detail += '══════════════════════════════════\n\n'
    detail += `Nama    : ${item.nama_barang}\n`
    detail += `Kode    : ${item.kode_barang}\n`
    detail += `Kategori: ${item.kategori}\n`
    detail += `Stok    : ${item.stok} pcs\n\n`
    detail += '━ Rincian Harga ━\n'
    detail += `Harga Dasar : ${formatIDR(item.harga_jual)}\n`
    detail += `Biaya Admin : ${formatIDR(cost.tax + cost.fee)}\n`
    detail += `Total Bayar : ${formatIDR(cost.total)}\n\n`
    detail += '━ Perintah ━\n'
    detail += `Beli produk ini: .beli ${index + 1}\n`
    detail += `Kembali: .store`
    
    return detail
}

let handler = async (m, { conn, text, command, usedPrefix, isOwner }) => {
    // ==========================================
    // PERINTAH START/MENU - TAMPILKAN GAMBAR
    // ==========================================
    if (command === 'start' || command === 'menu') {
        try {
            // Cek apakah file gambar ada
            const imagePath = path.join(process.cwd(), 'media', 'acaku.png')
            
            if (fs.existsSync(imagePath)) {
                // Kirim gambar dengan caption
                const caption = 
                    '╔══════════════════════════════════╗\n' +
                    '║    SELAMAT DATANG DI ACAMEDIA    ║\n' +
                    '╚══════════════════════════════════╝\n\n' +
                    '📱 *Toko Digital Terpercaya*\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                    '🔹 *Perintah Utama:*\n' +
                    '• .store - Lihat semua produk\n' +
                    '• .beli [nomor] - Beli produk\n' +
                    '• .store [nomor] - Detail produk\n' +
                    '• .store [nama] - Cari produk\n\n' +
                    '🔹 *Pembayaran:*\n' +
                    '• QRIS (Instant)\n' +
                    '• Otomatis 24/7\n' +
                    `• Waktu: ${SETTINGS.expired} menit\n\n` +
                    '🔹 *Hubungi Admin:*\n' +
                    'Jika ada kendala atau pertanyaan\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                    '🚀 *Mulai Belanja:* .store'
                
                await conn.sendMessage(m.chat, {
                    image: { url: imagePath },
                    caption: caption
                }, { quoted: m })
            } else {
                // Jika gambar tidak ditemukan, kirim teks saja
                m.reply(
                    '╔══════════════════════════════════╗\n' +
                    '║    SELAMAT DATANG DI ACAMEDIA    ║\n' +
                    '╚══════════════════════════════════╝\n\n' +
                    'Mulai belanja: .store'
                )
            }
        } catch (error) {
            console.error('Error loading image:', error)
            m.reply(
                '╔══════════════════════════════════╗\n' +
                '║    SELAMAT DATANG DI ACAMEDIA    ║\n' +
                '╚══════════════════════════════════╝\n\n' +
                'Mulai belanja: .store'
            )
        }
        return
    }
    
    // ==========================================
    // LOGIKA TOKO DAN PEMBELIAN
    // ==========================================
    const db = await loadDB()
    
    console.log('Database:', db.length, 'items')
    
    const args = text.trim().split(/ +/)
    const subCommand = args[0] ? args[0].toLowerCase() : ''

    // LOGIKA OWNER (CRUD)
    if (subCommand === 'add' && isOwner) {
        if (!args[1]) {
            return m.reply(`Format tambah produk:\n${usedPrefix}store add nama|kategori|harga|stok|kode\n\nContoh:\n${usedPrefix}store add Spotify Premium|Software|15000|50|SPOT001`)
        }
        
        const input = text.slice(4).split('|').map(v => v.trim())
        if (input.length < 5) {
            return m.reply(`Format tidak lengkap! Gunakan:\n${usedPrefix}store add nama|kategori|harga|stok|kode`)
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
            return m.reply(`Produk berhasil ditambahkan!\n\nNama: ${newItem.nama_barang}\nKategori: ${newItem.kategori}\nHarga: ${formatIDR(newItem.harga_jual)}\nStok: ${newItem.stok}\nKode: ${newItem.kode_barang}`)
        } else {
            return m.reply('Gagal menyimpan produk!')
        }
    }

    if (subCommand === 'del' && isOwner) {
        const index = parseInt(args[1]) - 1
        
        if (isNaN(index) || index < 0 || index >= db.length) {
            return m.reply(`Nomor tidak valid! Gunakan ${usedPrefix}store list untuk melihat daftar produk.`)
        }
        
        const removed = db[index]
        db.splice(index, 1)
        const success = await saveDB(db)
        
        if (success) {
            return m.reply(`Produk "${removed.nama_barang}" berhasil dihapus.\nSisa produk: ${db.length} items`)
        } else {
            return m.reply('Gagal menghapus produk!')
        }
    }

    if (subCommand === 'list' && isOwner) {
        if (db.length === 0) {
            return m.reply('Database kosong!')
        }
        
        let listText = 'DAFTAR PRODUK\n'
        listText += '══════════════════════════════════\n\n'
        
        db.forEach((item, i) => {
            const cost = getFinalPrice(item.harga_jual)
            
            listText += `${i + 1}. ${item.nama_barang}\n`
            listText += `   Kode: ${item.kode_barang} | Kategori: ${item.kategori}\n`
            listText += `   Harga: ${formatIDR(item.harga_jual)} → ${formatIDR(cost.total)}\n`
            listText += `   Stok: ${item.stok} pcs\n`
            listText += `   ─────────────────────────────\n\n`
        })
        
        listText += `Total: ${db.length} produk\n`
        listText += `Hapus: ${usedPrefix}store del [nomor]`
        
        return m.reply(listText)
    }

    // LOGIKA USER (PEMBAYARAN/BELI)
    if (command === 'beli') {
        if (!text) {
            return m.reply(`Format: ${usedPrefix}beli [nomor]\nContoh: ${usedPrefix}beli 1\n\nLihat produk: ${usedPrefix}store`)
        }
        
        const index = parseInt(args[0]) - 1
        const item = db[index]
        
        if (!item) {
            return m.reply(`Produk tidak ditemukan!\n\nCek daftar produk:\n${usedPrefix}store`)
        }
        
        if (item.stok <= 0) {
            return m.reply(`Stok habis!\n\n${item.nama_barang}\nStok: 0 pcs\n\nCek produk lain: ${usedPrefix}store`)
        }
        
        const cost = getFinalPrice(item.harga_jual)
        
        // LANGSUNG PROSES PEMBAYARAN TANPA KONFIRMASI
        await m.reply('Menyiapkan pembayaran...')
        
        try {
            const res = await createQris(cost.total, item.nama_barang)
            const exp = new Date(Date.now() + (SETTINGS.expired * 60000))
            
            // Generate QR Code URL dengan api.qrserver.com
            const qrCodeUrl = generateQRCodeUrl(res.payment_number)
            
            const paymentInfo = 
                '══════════════════════════════════\n' +
                'PEMBAYARAN QRIS\n' +
                '══════════════════════════════════\n\n' +
                `Produk: ${item.nama_barang}\n` +
                `Kode: ${item.kode_barang}\n` +
                `Kategori: ${item.kategori}\n\n` +
                'Rincian Biaya:\n' +
                '─────────────────────────────\n' +
                `Harga Produk : ${formatIDR(cost.base)}\n` +
                `Biaya Admin  : ${formatIDR(cost.tax + cost.fee)}\n` +
                '─────────────────────────────\n' +
                `TOTAL BAYAR  : ${formatIDR(cost.total)}\n` +
                '─────────────────────────────\n\n' +
                `Stok Tersedia: ${item.stok} pcs\n\n` +
                `Berlaku hingga: ${exp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${SETTINGS.expired} menit)\n\n` +
                'SCAN QR CODE DI ATAS\n' +
                `atau bayar ke nomor:\n${res.payment_number}\n\n` +
                'JANGAN TUTUP PESAN INI'
            
            const msg = await conn.sendMessage(m.chat, {
                image: { 
                    url: qrCodeUrl
                },
                caption: paymentInfo
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
                        m.reply('Waktu pembayaran habis!')
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
                    
                    const successMsg = 
                        '══════════════════════════════════\n' +
                        'PEMBAYARAN BERHASIL\n' +
                        '══════════════════════════════════\n\n' +
                        `Produk: ${item.nama_barang}\n` +
                        `Kode: ${item.kode_barang}\n` +
                        `Total: ${formatIDR(cost.total)}\n\n` +
                        `Stok tersisa: ${item.stok}\n` +
                        `Waktu: ${new Date().toLocaleTimeString('id-ID')}\n\n` +
                        'Hubungi admin untuk pengiriman produk'
                    
                    m.reply(successMsg)
                }
            }, 5000)
            
            return
            
        } catch (e) {
            console.error('Payment error:', e)
            return m.reply('Gagal membuat pembayaran!\n\nCoba beberapa saat lagi atau hubungi admin.')
        }
    }

    // LOGIKA PENCARIAN PRODUK
    if (subCommand && !['add', 'del', 'list', 'help'].includes(subCommand)) {
        // Pencarian berdasarkan nomor
        if (!isNaN(subCommand)) {
            const index = parseInt(subCommand) - 1
            const item = db[index]
            
            if (item) {
                return m.reply(showProductDetail(item, index, db))
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
                return m.reply(`Pencarian: "${text}"\n\nTidak ditemukan!\n\nCoba cari dengan kata kunci lain atau lihat semua produk:\n${usedPrefix}store`)
            }
            
            if (results.length === 1) {
                const item = results[0]
                const index = db.indexOf(item)
                return m.reply(showProductDetail(item, index, db))
            }
            
            let searchText = `Hasil Pencarian: "${text}"\n`
            searchText += `Ditemukan: ${results.length} produk\n\n`
            
            results.slice(0, 10).forEach((item, i) => {
                const globalIndex = db.indexOf(item) + 1
                const cost = getFinalPrice(item.harga_jual)
                
                searchText += `${globalIndex}. ${item.nama_barang}\n`
                searchText += `   ${formatIDR(cost.total)} | Stok: ${item.stok}\n`
                searchText += `   Beli: .beli ${globalIndex}\n`
                if (i < Math.min(10, results.length) - 1) searchText += '\n'
            })
            
            if (results.length > 10) {
                searchText += `\n... dan ${results.length - 10} produk lainnya.\nGunakan pencarian lebih spesifik.`
            }
            
            searchText += `\n\nLihat semua: ${usedPrefix}store`
            
            return m.reply(searchText)
        }
    }

    // KATALOG UTAMA (STORE DEFAULT) - TAMPIL SEMUA
    if (db.length === 0) {
        return m.reply(
            '══════════════════════════════════\n' +
            'TOKO KOSONG\n' +
            '══════════════════════════════════\n\n' +
            'Belum ada produk tersedia.\n\n' +
            'Hubungi admin untuk info produk.'
        )
    }
    
    // Tampilkan semua produk sekaligus
    let storeText = 
        '══════════════════════════════════\n' +
        'ACAMEDIA STORE\n' +
        '══════════════════════════════════\n\n' +
        `Total Produk: ${db.length}\n\n`
    
    storeText += createCompactProductList(db)
    
    // Menu bantuan
    storeText += '\n' + '━'.repeat(35) + '\n'
    storeText += 'CARA PEMBELIAN:\n'
    storeText += '1. .store - Lihat semua produk\n'
    storeText += '2. .store [nomor] - Detail produk\n'
    storeText += '3. .beli [nomor] - Beli produk\n'
    storeText += '4. .store [nama] - Cari produk\n\n'
    
    storeText += 'CATATAN:\n'
    storeText += `• Pembayaran via QRIS (${SETTINGS.expired} menit)\n`
    storeText += '• Stok dapat berubah setiap saat\n'
    
    if (isOwner) {
        storeText += '\n' + '━'.repeat(35) + '\n'
        storeText += 'MENU ADMIN:\n'
        storeText += '• .store add - Tambah produk\n'
        storeText += '• .store del [nomor] - Hapus produk\n'
        storeText += '• .store list - Daftar produk lengkap\n'
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
                'Content-Type': 'application/json'
            },
            timeout: 10000
        })
        return res.data.payment
    } catch (error) {
        console.error('Create QRIS Error:', error.message)
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
        console.error('Check Status Error:', error.message)
        return null
    }
}

// Command help
handler.help = [
    'store [nomor/cari]',
    'beli [nomor]',
    'store add [nama|kategori|harga|stok|kode] (owner)',
    'store del [nomor] (owner)',
    'store list (owner)'
]

handler.tags = ['shop', 'payment', 'store']
handler.command = /^(store|toko|beli|menu|start|help|produk|shop)$/i

export default handler
