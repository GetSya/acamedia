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

// --- SUPABASE LOGIC ---
const loadDB = async () => {
    try {
        console.log('🔄 Mengambil data dari Supabase...')
        
        // Coba query langsung ke tabel master_data
        const { data, error } = await supabase
            .from('master_data')
            .select('*')
            .eq('user_id', USER_ID)
        
        console.log('Hasil query:', data?.length || 0, 'baris')
        
        if (error) {
            console.error('❌ Error loading from Supabase:', error)
            return []
        }
        
        if (!data || data.length === 0) {
            console.log('⚠️ Tidak ada data untuk user_id:', USER_ID)
            return []
        }
        
        // Ambil daftar_item dari baris pertama
        const daftarItem = data[0].daftar_item
        
        if (!daftarItem) {
            console.log('⚠️ daftar_item kosong atau null')
            return []
        }
        
        console.log('✅ Data loaded:', daftarItem.length, 'items')
        return daftarItem
        
    } catch (error) {
        console.error('❌ Error in loadDB:', error)
        return []
    }
}

const saveDB = async (data) => {
    try {
        console.log('💾 Menyimpan data ke Supabase...')
        
        const { error } = await supabase
            .from('master_data')
            .update({ 
                daftar_item: data,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', USER_ID)
        
        if (error) {
            console.error('❌ Error saving to Supabase:', error)
            return false
        }
        
        console.log('✅ Data saved:', data.length, 'items')
        return true
    } catch (error) {
        console.error('❌ Error in saveDB:', error)
        return false
    }
}

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
    let db = await loadDB()
    
    console.log('📊 Database di handler:', db.length, 'items')
    
    let args = text.trim().split(/ +/)
    let subCommand = args[0] ? args[0].toLowerCase() : ''

    // ==========================================
    // LOGIKA OWNER (CRUD)
    // ==========================================
    if (subCommand === 'add' && isOwner) {
        let input = text.split('add')[1]?.split('|').map(v => v.trim())
        if (!input || input.length < 5) return m.reply(`*Format Owner (Add):*\n${usedPrefix}store add nama_barang|kategori|harga_jual|stok|kode_barang\n\n*Contoh:*\n${usedPrefix}store add SPOTIFY PREMIUM 30 HARI|SOFTWARE|10000|999|SPOTIFYPREM001`)
        
        let [nama_barang, kategori, harga_jual, stok, kode_barang] = input
        
        // Buat item baru SESUAI FORMAT DATABASE
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
            return m.reply(`✅ *Produk "${nama_barang}" Disimpan!*\n📦 Stok: ${newItem.stok}\n💰 Harga: ${formatIDR(newItem.harga_jual)}\n🏷️ Kode: ${newItem.kode_barang}`)
        } else {
            return m.reply('❌ Gagal menyimpan produk.')
        }
    }

    if (subCommand === 'del' && isOwner) {
        let index = parseInt(args[1]) - 1
        if (index >= 0 && db[index]) {
            let removed = db.splice(index, 1)
            const success = await saveDB(db)
            if (success) {
                return m.reply(`🗑️ *"${removed[0].nama_barang}" dihapus.*`)
            } else {
                return m.reply('❌ Gagal menghapus produk.')
            }
        }
        return m.reply('❌ Nomor produk tidak ditemukan.')
    }

    if (subCommand === 'list' && isOwner) {
        if (db.length === 0) return m.reply('📭 Database kosong.')
        
        let listText = '📋 *DAFTAR PRODUK:*\n\n'
        db.forEach((item, i) => {
            listText += `${i + 1}. ${item.nama_barang}\n`
            listText += `   📦 ${item.kategori} | 💰 ${formatIDR(item.harga_jual)}\n`
            listText += `   📊 ${item.stok} ${item.satuan} | 🏷️ ${item.kode_barang}\n`
            listText += `   ──────────────\n`
        })
        return m.reply(listText)
    }

    // ==========================================
    // LOGIKA USER (PEMBAYARAN/BELI)
    // ==========================================
    if (command === 'beli') {
        let index = parseInt(args[0]) - 1
        let item = db[index]
        
        if (!item) return m.reply(`❌ Produk tidak ditemukan.\n*Pilih produk:* .beli 1\n*Lihat produk:* .store`)

        if (item.stok <= 0) {
            return m.reply('❌ Stok produk habis.')
        }
        
        let cost = getFinalPrice(item.harga_jual)
        
        await m.reply('🔄 *Menyiapkan QRIS...*')

        try {
            const res = await createQris(cost.total, item.nama_barang)
            let exp = new Date(Date.now() + (SETTINGS.expired * 60000))

            let caption = `┌───〔 PEMBAYARAN 〕───\n`
            caption += `│ 📦 ${item.nama_barang}\n`
            caption += `│ 🏷️ ${item.kode_barang}\n`
            caption += `│ 📦 ${item.kategori}\n`
            caption += `│ 💰 ${formatIDR(cost.base)}\n`
            caption += `│ 🧾 Biaya Admin: ${formatIDR(cost.tax)}\n`
            caption += `│ 📊 Stok: ${item.stok}\n`
            caption += `├─────────────────\n`
            caption += `│ 🏦 Total: *${formatIDR(cost.total)}*\n`
            caption += `│ 🕒 Valid S/D: ${exp.toLocaleTimeString('id-ID')}\n`
            caption += `└─────────────────\n\n`
            caption += `📱 Scan QR untuk checkout.`

            let msg = await conn.sendMessage(m.chat, { 
                image: { url: `https://quickchart.io/qr?text=${encodeURIComponent(res.payment_number)}` },
                caption: caption
            }, { quoted: m })

            // Check Status
            let check = setInterval(async () => {
                if (Date.now() > exp.getTime()) {
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
                    
                    // Update stok
                    item.stok = Math.max(0, item.stok - 1)
                    await saveDB(db)
                    
                    m.reply(`✅ *ORDER SUKSES!*\n\n📦 ${item.nama_barang}\n💰 ${formatIDR(cost.total)}\n📊 Stok Tersisa: ${item.stok}\n🆔 ${item.kode_barang}\n\nHubungi Owner.`)
                }
            }, 7000)
            return
        } catch (e) { 
            console.error('Payment error:', e)
            return m.reply('❌ Sistem Payment error.') 
        }
    }

    // ==========================================
    // LOGIKA NAVIGASI
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
            let cost = getFinalPrice(item.harga_jual)
            let textDetail = `🔖 *INFO PRODUK*\n\n`
            textDetail += `🏷️ ${item.nama_barang}\n`
            textDetail += `📦 ${item.kategori}\n`
            textDetail += `📋 ${item.satuan}\n`
            textDetail += `📊 ${item.stok}\n`
            textDetail += `🆔 ${item.kode_barang}\n\n`
            textDetail += `💰 Harga: ${formatIDR(item.harga_jual)}\n`
            textDetail += `🧾 Admin: ${formatIDR(cost.tax)}\n`
            textDetail += `🏦 TOTAL: *${formatIDR(cost.total)}*\n\n`
            textDetail += `🛒 .beli ${db.indexOf(item) + 1}`
            return m.reply(textDetail)
        }
    }

    // CATALOG UTAMA
    if (db.length === 0) {
        console.log('⚠️ Database kosong saat menampilkan katalog')
        return m.reply('🏪 *TOKO KOSONG*\n\nBelum ada produk.\n\nHubungi admin.')
    }
    
    console.log('📱 Menampilkan katalog:', db.length, 'items')
    
    let sections = {}
    db.forEach((item, i) => {
        const kategori = item.kategori || 'UNCATEGORIZED'
        if (!sections[kategori]) sections[kategori] = []
        
        let cost = getFinalPrice(item.harga_jual)
        
        sections[kategori].push(`│ ${i + 1}. ${item.nama_barang}\n│    ╰ ${formatIDR(cost.total)} | Stok: ${item.stok}`)
    })

    let menuToko = `🏪 *ACAMEDIA STORE*\n\n`
    for (let kat in sections) {
        menuToko += `┏──『 ${kat.toUpperCase()} 』\n`
        menuToko += sections[kat].join('\n')
        menuToko += `\n┗───────────────\n\n`
    }
    menuToko += `📋 Total: ${db.length} item\n\n`
    menuToko += `👉 .store [nomor] - detail produk\n`
    menuToko += `👉 .store [nama] - cari produk\n`
    menuToko += `👉 .beli [nomor] - checkout`

    if (isOwner) {
        menuToko += `\n\n🛠️ *Admin:*\n`
        menuToko += `• .store add nama|kategori|harga|stok|kode\n`
        menuToko += `• .store del [nomor]\n`
        menuToko += `• .store list`
    }

    m.reply(menuToko)
}

// --- API PAKASIR ---
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
