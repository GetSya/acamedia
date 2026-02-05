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
        home: '🏠',
        back: '↩️',
        next: '➡️',
        prev: '⬅️',
        page: '📄'
    }
}

// --- STATE MANAGEMENT ---
let userStates = new Map()

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
    return `╔══════════════════════════════╗
║         ${DESIGN.icons.store}          ║
║       *ACAMEDIA STORE*       ║
╠══════════════════════════════╣
║ ${title.toUpperCase().padEnd(28)} ║
${subtitle ? `║ ${subtitle.padEnd(28)} ║\n╠══════════════════════════════╣` : '╠══════════════════════════════╣'}`
}

const createProductCard = (item, index, showDetail = false, globalIndex = null) => {
    const cost = getFinalPrice(item.harga_jual)
    
    if (showDetail) {
        return `╔══════════════════════════════╗
║ ${DESIGN.icons.product} *${item.nama_barang}*
╠══════════════════════════════╣
║ ${DESIGN.icons.category} Kategori: ${item.kategori}
║ ${DESIGN.icons.code} Kode: ${item.kode_barang}
║ ${DESIGN.icons.stock} Stok: ${item.stok} ${item.satuan}
╠══════════════════════════════╣
║ ${DESIGN.icons.price} Harga: ${formatIDR(item.harga_jual)}
║ ${DESIGN.icons.admin} Admin: ${formatIDR(cost.tax)}
║ ${DESIGN.colors.money} *TOTAL: ${formatIDR(cost.total)}*
╚══════════════════════════════╝
${DESIGN.icons.cart} *Beli:* \`.beli ${globalIndex !== null ? globalIndex : index + 1}\``
    }
    
    const itemNumber = globalIndex !== null ? globalIndex : index + 1
    return `${DESIGN.icons.product} *${itemNumber}.* ${item.nama_barang}
   ${DESIGN.icons.price} ${formatIDR(cost.total)} | ${DESIGN.icons.stock} ${item.stok} | ${DESIGN.icons.code} ${item.kode_barang}`
}

// --- CATEGORY FUNCTIONS ---
const groupByCategory = (products) => {
    const categories = {}
    
    products.forEach((product, index) => {
        const category = product.kategori || 'UMUM'
        if (!categories[category]) {
            categories[category] = {
                products: [],
                total: 0
            }
        }
        categories[category].products.push({...product, globalIndex: index + 1})
        categories[category].total++
    })
    
    return categories
}

const showCategoryMenu = async (m, db) => {
    const categories = groupByCategory(db)
    const categoryList = Object.keys(categories)
    
    if (categoryList.length === 0) {
        return m.reply(`${createHeader('KATEGORI')}
${DESIGN.colors.warning} *Tidak ada kategori tersedia*

${DESIGN.colors.info} Hubungi admin untuk menambahkan produk.`)
    }
    
    let menuText = `${createHeader('PILIH KATEGORI', `Total: ${categoryList.length} kategori`)}

${DESIGN.icons.category} *Daftar Kategori:*\n`
    
    categoryList.forEach((category, index) => {
        const count = categories[category].total
        menuText += `\n${DESIGN.icons.category} *${index + 1}.* ${category.toUpperCase()}`
        menuText += `\n   📊 ${count} produk tersedia`
        menuText += `\n   ──────────────────────`
    })
    
    menuText += `\n\n${DESIGN.icons.search} *PERINTAH:*
• \`.store [nomor_kategori]\` - Lihat produk dalam kategori
• \`.store all\` - Lihat semua produk
• \`.store [nama_produk]\` - Cari produk
• \`.store [kode_produk]\` - Detail produk

${DESIGN.icons.cart} *Contoh:* \`.store 1\` untuk lihat kategori pertama`
    
    return m.reply(menuText)
}

const showProductsByCategory = async (m, db, categoryIndex, page = 1) => {
    const categories = groupByCategory(db)
    const categoryList = Object.keys(categories)
    
    if (categoryIndex < 1 || categoryIndex > categoryList.length) {
        return m.reply(`${DESIGN.colors.error} *Kategori tidak ditemukan*
        
${DESIGN.icons.home} Ketik \`.store\` untuk melihat daftar kategori`)
    }
    
    const selectedCategory = categoryList[categoryIndex - 1]
    const categoryData = categories[selectedCategory]
    const products = categoryData.products
    
    // Pagination
    const itemsPerPage = 5
    const totalPages = Math.ceil(products.length / itemsPerPage)
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, products.length)
    const pageProducts = products.slice(startIndex, endIndex)
    
    let categoryText = `${createHeader(`KATEGORI: ${selectedCategory}`, `Halaman ${page}/${totalPages}`)}

${DESIGN.icons.product} *Produk (${products.length} item):*\n`
    
    pageProducts.forEach((product, index) => {
        categoryText += `\n${createProductCard(product, index, false, product.globalIndex)}`
        categoryText += `\n   ──────────────────────`
    })
    
    // Pagination navigation
    categoryText += `\n\n${DESIGN.icons.page} *Navigasi Halaman:*`
    if (page > 1) {
        categoryText += `\n${DESIGN.icons.prev} \`.store ${categoryIndex} page ${page - 1}\` - Sebelumnya`
    }
    if (page < totalPages) {
        categoryText += `\n${DESIGN.icons.next} \`.store ${categoryIndex} page ${page + 1}\` - Selanjutnya`
    }
    
    categoryText += `\n\n${DESIGN.icons.search} *PERINTAH:*
• \`.store\` - Kembali ke menu kategori
• \`.store [nomor_produk]\` - Detail produk
• \`.beli [nomor_produk]\` - Beli produk
• \`.store all\` - Semua produk`

    // Save user state for navigation
    const userId = m.sender
    userStates.set(userId, {
        view: 'category',
        category: selectedCategory,
        page: page,
        categoryIndex: categoryIndex
    })
    
    return m.reply(categoryText)
}

const showAllProducts = async (m, db, page = 1) => {
    // Pagination
    const itemsPerPage = 8
    const totalPages = Math.ceil(db.length / itemsPerPage)
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, db.length)
    const pageProducts = db.slice(startIndex, endIndex)
    
    let allText = `${createHeader('SEMUA PRODUK', `Halaman ${page}/${totalPages}`)}

${DESIGN.icons.list} *Total: ${db.length} produk*\n`
    
    pageProducts.forEach((product, index) => {
        const globalIndex = startIndex + index + 1
        allText += `\n${createProductCard(product, index, false, globalIndex)}`
        allText += `\n   ──────────────────────`
    })
    
    // Pagination navigation
    allText += `\n\n${DESIGN.icons.page} *Navigasi Halaman:*`
    if (page > 1) {
        allText += `\n${DESIGN.icons.prev} \`.store all page ${page - 1}\` - Sebelumnya`
    }
    if (page < totalPages) {
        allText += `\n${DESIGN.icons.next} \`.store all page ${page + 1}\` - Selanjutnya`
    }
    
    allText += `\n\n${DESIGN.icons.search} *PERINTAH:*
• \`.store\` - Menu kategori
• \`.store [nomor]\` - Detail produk
• \`.beli [nomor]\` - Beli produk
• \`.store [nama]\` - Cari produk`

    // Save user state
    const userId = m.sender
    userStates.set(userId, {
        view: 'all',
        page: page
    })
    
    return m.reply(allText)
}

// --- MAIN HANDLER ---
let handler = async (m, { conn, text, command, usedPrefix, isOwner }) => {
    let db = await loadDB()
    
    let args = text.trim().split(/ +/)
    let subCommand = args[0] ? args[0].toLowerCase() : ''
    let pageArg = args[2] === 'page' && parseInt(args[3]) ? parseInt(args[3]) : 1
    
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
\`${usedPrefix}store add Spotify Premium|SOFTWARE|10000|999|SPOT001\`

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
        
        const categories = groupByCategory(db)
        let listText = `${createHeader('DAFTAR PRODUK', 'Owner View')}

${DESIGN.icons.database} *Total: ${db.length} produk*\n`
        
        Object.keys(categories).forEach(category => {
            listText += `\n${DESIGN.icons.category} *${category.toUpperCase()}* (${categories[category].total} produk)`
            listText += `\n${'─'.repeat(30)}`
            
            categories[category].products.forEach((product, index) => {
                listText += `\n${index + 1}. ${product.nama_barang}`
                listText += `\n   🏷️ ${product.kode_barang} | 💰 ${formatIDR(product.harga_jual)}`
                listText += `\n   📊 ${product.stok} | 🔢 Global: ${product.globalIndex}`
            })
            listText += `\n\n`
        })
        
        return m.reply(listText)
    }

    // ==========================================
    // USER COMMANDS (PURCHASE)
    // ==========================================
    if (command === 'beli') {
        let input = args[0]
        let item
        
        // Check if input is a number (product index)
        if (!isNaN(input)) {
            let index = parseInt(input) - 1
            item = db[index]
            
            if (!item) {
                const notFound = `${DESIGN.colors.error} *Produk Tidak Ditemukan*

${DESIGN.icons.search} Gunakan: \`.beli [nomor_produk]\`
${DESIGN.icons.home} Lihat produk: \`.store\`

${DESIGN.colors.info} Contoh: \`.beli 1\``
                return m.reply(notFound)
            }
        } else {
            // Search by product code or name
            item = db.find(v => 
                v.kode_barang.toLowerCase() === input.toLowerCase() ||
                v.nama_barang.toLowerCase().includes(input.toLowerCase())
            )
            
            if (!item) {
                return m.reply(`${DESIGN.colors.error} *Produk tidak ditemukan*
                
${DESIGN.icons.search} Coba cari dengan kode produk atau gunakan nomor produk dari \`.store\``)
            }
        }

        if (item.stok <= 0) {
            return m.reply(`${DESIGN.colors.error} *STOK HABIS*\n\n"${item.nama_barang}" sedang tidak tersedia.`)
        }
        
        let cost = getFinalPrice(item.harga_jual)
        
        await m.reply(`${DESIGN.icons.qris} *Menyiapkan QRIS...*`)

        try {
            const res = await createQris(cost.total, item.nama_barang)
            
            const paymentBox = `╔══════════════════════════════╗
║     ${DESIGN.icons.payment} *PEMBAYARAN*     ║
╠══════════════════════════════╣
║ ${DESIGN.icons.product} ${item.nama_barang}
║ ${DESIGN.icons.code} ${item.kode_barang}
╠══════════════════════════════╣
║ ${DESIGN.icons.price} Harga: ${formatIDR(cost.base)}
║ ${DESIGN.icons.admin} Admin: ${formatIDR(cost.tax)}
╠══════════════════════════════╣
║ ${DESIGN.colors.money} *TOTAL: ${formatIDR(cost.total)}*
║ ${DESIGN.icons.time} Berlaku: ${SETTINGS.expired} menit
╚══════════════════════════════╝`
            
            const caption = `${paymentBox}\n\n${DESIGN.icons.qris} *Scan QR Code di atas untuk pembayaran*`

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
    // NAVIGATION & SEARCH
    // ==========================================
    
    // Handle "store all" with pagination
    if (subCommand === 'all') {
        return await showAllProducts(m, db, pageArg)
    }
    
    // Handle category navigation with pagination
    if (!isNaN(subCommand) && subCommand !== '') {
        const categoryIndex = parseInt(subCommand)
        return await showProductsByCategory(m, db, categoryIndex, pageArg)
    }
    
    // Handle search for product by name or code
    if (subCommand && subCommand !== 'add' && subCommand !== 'del' && subCommand !== 'list') {
        // Search by product name or code
        const searchTerm = text.toLowerCase()
        const foundProducts = db.filter(v => 
            v.nama_barang.toLowerCase().includes(searchTerm) ||
            v.kode_barang.toLowerCase().includes(searchTerm)
        )
        
        if (foundProducts.length === 0) {
            return m.reply(`${DESIGN.colors.error} *Produk tidak ditemukan*
            
${DESIGN.icons.search} Coba cari dengan kata kunci lain atau gunakan:
• \`.store\` - Lihat kategori
• \`.store all\` - Lihat semua produk`)
        }
        
        if (foundProducts.length === 1) {
            // Show single product detail
            const item = foundProducts[0]
            const globalIndex = db.findIndex(p => p.id === item.id) + 1
            const detailText = createProductCard(item, 0, true, globalIndex)
            return m.reply(detailText)
        }
        
        // Show multiple search results
        let searchText = `${createHeader('HASIL PENCARIAN', `Ditemukan: ${foundProducts.length} produk`)}

${DESIGN.icons.search} *Hasil untuk "${text}":*\n`
        
        foundProducts.forEach((item, index) => {
            const globalIndex = db.findIndex(p => p.id === item.id) + 1
            searchText += `\n${createProductCard(item, index, false, globalIndex)}`
            searchText += `\n   ──────────────────────`
        })
        
        searchText += `\n\n${DESIGN.icons.search} *PERINTAH:*
• \`.store [nomor]\` - Detail produk (gunakan nomor global)
• \`.beli [nomor]\` - Beli produk
• \`.store\` - Kembali ke menu kategori`
        
        return m.reply(searchText)
    }
    
    // ==========================================
    // MAIN CATALOG (CATEGORY MENU)
    // ==========================================
    if (db.length === 0) {
        const emptyStore = `${createHeader('TOKO KOSONG')}

${DESIGN.colors.warning} *Belum ada produk yang tersedia*

${DESIGN.colors.info} Hubungi admin untuk informasi lebih lanjut.

${DESIGN.icons.owner} *Kontak Admin:* Owner`
        return m.reply(emptyStore)
    }
    
    // Show category menu by default
    return await showCategoryMenu(m, db)
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
