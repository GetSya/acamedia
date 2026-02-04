import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

// --- SUPABASE CONFIG ---
const SUPABASE_URL = 'https://xteposmfavnnevgqivub.supabase.co'
const SUPABASE_KEY = 'sb_publishable__iD2NyZNQa7HVnreBtYuow__aHIr6ie'
const USER_ID = '6db91251-7426-491b-bc87-121556bc2f1b'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- GLOBAL SETTINGS ---
const SETTINGS = {
    slug: 'acamedia',
    apikey: 'ZU0JBrZtUZSqI8nAqz73zbtgJFtj0tY5',
    expired: 10,
    feePercent: 0.007, // 0.7%
    feeFixed: 310,    // Rp 310
    jsonPath: path.join(process.cwd(), 'json', 'storekuh.json')
}

// --- SUPABASE LOGIC ---
const loadDB = async () => {
    try {
        const { data, error } = await supabase
            .from('master_data')
            .select('daftar_item')
            .eq('user_id', USER_ID)
            .maybeSingle()
        
        if (error) {
            console.error('Error loading from Supabase:', error)
            return []
        }
        
        console.log('Data loaded from Supabase:', data?.daftar_item?.length || 0, 'items')
        return data?.daftar_item || []
    } catch (error) {
        console.error('Error in loadDB:', error)
        return []
    }
}

const saveDB = async (data) => {
    try {
        const { data: existingData, error: checkError } = await supabase
            .from('master_data')
            .select('id')
            .eq('user_id', USER_ID)
            .maybeSingle()
        
        if (checkError) {
            console.error('Error checking existing data:', checkError)
            return false
        }
        
        let result
        if (existingData) {
            result = await supabase
                .from('master_data')
                .update({ 
                    daftar_item: data,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', USER_ID)
        } else {
            result = await supabase
                .from('master_data')
                .insert({ 
                    user_id: USER_ID,
                    daftar_item: data,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
        }
        
        if (result.error) {
            console.error('Error saving to Supabase:', result.error)
            return false
        }
        console.log('Data saved to Supabase:', data.length, 'items')
        return true
    } catch (error) {
        console.error('Error in saveDB:', error)
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
    let args = text.trim().split(/ +/)
    let subCommand = args[0] ? args[0].toLowerCase() : ''

    // ==========================================
    // LOGIKA OWNER (CRUD)
    // ==========================================
    if (subCommand === 'add' && isOwner) {
        let input = text.split('add')[1]?.split('|').map(v => v.trim())
        if (!input || input.length < 6) return m.reply(`*Format Owner (Add):*\n${usedPrefix}store add nama_barang|kategori|harga_jual|stok|satuan|kode_barang\n\n*Contoh:*\n${usedPrefix}store add SPOTIFY PREMIUM 30 HARI|SOFTWARE|10000|999|AKUN|SPOTIFYPREM001`)
        
        let [nama_barang, kategori, harga_jual, stok, satuan, kode_barang] = input
        
        // Buat item baru sesuai format database
        const newItem = {
            id: `ITM-${Date.now().toString().slice(-8)}`,
            nama_barang: nama_barang,
            kategori: kategori || 'SOFTWARE',
            harga_jual: parseInt(harga_jual.replace(/\D/g, '')) || 0,
            harga_beli: 0,
            stok: parseInt(stok.replace(/\D/g, '')) || 999,
            satuan: satuan || 'AKUN',
            tipe_harga: 'SINGLE',
            kode_barang: kode_barang || `ITM-${Date.now().toString().slice(-5)}`,
            multi_units: []
        }
        
        db.push(newItem)
        const success = await saveDB(db)
        if (success) {
            return m.reply(`✨ *Produk "${nama_barang}" Berhasil Disimpan!*\n📦 Stok: ${newItem.stok}\n💰 Harga: ${formatIDR(newItem.harga_jual)}\n🏷️ Kode: ${newItem.kode_barang}`)
        } else {
            return m.reply('❌ Gagal menyimpan produk ke database.')
        }
    }

    if (subCommand === 'del' && isOwner) {
        let index = parseInt(args[1]) - 1
        if (index >= 0 && db[index]) {
            let removed = db.splice(index, 1)
            const success = await saveDB(db)
            if (success) {
                return m.reply(`🗑️ *"${removed[0].nama_barang}" berhasil dihapus.*`)
            } else {
                return m.reply('❌ Gagal menghapus produk dari database.')
            }
        }
        return m.reply('❌ Nomor produk tidak ditemukan.')
    }

    if (subCommand === 'list' && isOwner) {
        if (db.length === 0) return m.reply('📭 Database kosong.')
        
        let listText = '📋 *DAFTAR PRODUK:*\n\n'
        db.forEach((item, i) => {
            listText += `${i + 1}. ${item.nama_barang}\n`
            listText += `   📦 Kategori: ${item.kategori}\n`
            listText += `   💰 Harga: ${formatIDR(item.harga_jual)}\n`
            listText += `   📊 Stok: ${item.stok} ${item.satuan}\n`
            listText += `   🏷️ Kode: ${item.kode_barang}\n`
            listText += `   ──────────────\n`
        })
        return m.reply(listText)
    }

    if (subCommand === 'update' && isOwner) {
        let index = parseInt(args[1]) - 1
        let field = args[2]
        let value = args.slice(3).join(' ')
        
        if (index < 0 || !db[index] || !field || !value) {
            return m.reply(`*Format Update:*\n${usedPrefix}store update [nomor] [field] [value]\n\n*Field yang tersedia:*\nnama_barang, kategori, harga_jual, stok, satuan, kode_barang\n\n*Contoh:*\n${usedPrefix}store update 1 stok 50`)
        }
        
        let item = db[index]
        let oldValue = item[field]
        
        if (field === 'harga_jual' || field === 'stok') {
            item[field] = parseInt(value.replace(/\D/g, '')) || 0
        } else {
            item[field] = value
        }
        
        const success = await saveDB(db)
        if (success) {
            return m.reply(`✏️ *Produk "${item.nama_barang}" Diupdate!*\n📝 ${field}: ${oldValue} → ${item[field]}`)
        } else {
            return m.reply('❌ Gagal mengupdate produk.')
        }
    }

    // ==========================================
    // LOGIKA USER (PEMBAYARAN/BELI)
    // ==========================================
    if (command === 'beli' || subCommand === 'buy') {
        let index = parseInt(command === 'beli' ? args[0] : args[1]) - 1
        let item = db[index]
        if (!item) return m.reply(`❌ Produk tidak ditemukan.\n*Pilih produk:* .beli 1\n*Lihat produk:* .store`)

        // Cek stok
        if (item.stok <= 0) {
            return m.reply('❌ Maaf, stok produk ini habis.')
        }
        
        let cost = getFinalPrice(item.harga_jual)
        
        await m.reply('🔄 *Menyiapkan QRIS Aktif...*')

        try {
            const res = await createQris(cost.total, item.nama_barang)
            let exp = new Date(Date.now() + (SETTINGS.expired * 60000))

            let caption = `┌───〔 *PEMBAYARAN* 〕───\n`
            caption += `│ 📦 *Item:* ${item.nama_barang}\n`
            caption += `│ 🏷️ *Kode:* ${item.kode_barang}\n`
            caption += `│ 📦 *Kategori:* ${item.kategori}\n`
            caption += `│ 📋 *Satuan:* ${item.satuan}\n`
            caption += `│ 💰 *Harga:* ${formatIDR(cost.base)}\n`
            caption += `│ 🧾 *Biaya Admin:* ${formatIDR(cost.tax)}\n`
            caption += `│ 📊 *Stok Tersedia:* ${item.stok}\n`
            caption += `├─────────────────\n`
            caption += `│ 🏦 *Total:* *${formatIDR(cost.total)}*\n`
            caption += `│ 🕒 *Valid S/D:* ${exp.toLocaleTimeString('id-ID')}\n`
            caption += `└─────────────────\n\n`
            caption += `📱 *Scan QR di atas untuk checkout.*\n_Pembayaran otomatis diproses bot._`

            let msg = await conn.sendMessage(m.chat, { 
                image: { url: `https://quickchart.io/qr?text=${encodeURIComponent(res.payment_number)}` },
                caption: caption
            }, { quoted: m })

            // Check Status Logic (7 Sec Interval)
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
                    
                    // Update stok setelah pembayaran berhasil
                    item.stok = Math.max(0, item.stok - 1)
                    await saveDB(db)
                    
                    m.reply(`✅ *ORDER SUKSES!*\n\n📦 *Item:* ${item.nama_barang}\n💰 *Total Bayar:* ${formatIDR(cost.total)}\n📊 *Stok Tersisa:* ${item.stok}\n🆔 *Kode Produk:* ${item.kode_barang}\n\n_Mohon hubungi Owner untuk mendapatkan produk._`)
                }
            }, 7000)
            return
        } catch (e) { 
            console.error('Payment error:', e)
            return m.reply('❌ Sistem Payment sedang maintenance.') 
        }
    }

    // ==========================================
    // LOGIKA NAVIGATION (STORE & DETAIL)
    // ==========================================
    
    // Logika Pintar: Jika ketik ".store 1" atau ".store spotify"
    if (subCommand && subCommand !== 'add' && subCommand !== 'del' && subCommand !== 'list' && subCommand !== 'update') {
        let item
        if (!isNaN(subCommand)) {
            item = db[parseInt(subCommand) - 1] // Berdasarkan Angka
        } else {
            // Cari berdasarkan nama atau kode barang
            item = db.find(v => 
                v.nama_barang.toLowerCase().includes(subCommand) ||
                v.kode_barang.toLowerCase().includes(subCommand)
            )
        }

        if (item) {
            let cost = getFinalPrice(item.harga_jual)
            let textDetail = `🔖 *INFO PRODUK*\n\n`
            textDetail += `🏷️ *${item.nama_barang}*\n`
            textDetail += `📦 *Kategori:* ${item.kategori}\n`
            textDetail += `📋 *Satuan:* ${item.satuan}\n`
            textDetail += `📊 *Stok:* ${item.stok}\n`
            textDetail += `🆔 *Kode:* ${item.kode_barang}\n\n`
            textDetail += `💰 *Harga:* ${formatIDR(item.harga_jual)}\n`
            textDetail += `🧾 *Biaya Admin:* ${formatIDR(cost.tax)}\n`
            textDetail += `🏦 *TOTAL BAYAR:* *${formatIDR(cost.total)}*\n`
            textDetail += `_(Termasuk PPN & Admin)_\n\n`
            textDetail += `🛒 Ketik *.beli ${db.indexOf(item) + 1}* untuk membeli`
            return m.reply(textDetail)
        }
    }

    // CATALOG UTAMA
    if (db.length === 0) return m.reply('🏪 *TOKO KOSONG*\n\nBelum ada produk yang tersedia saat ini.\n\n_Mohon hubungi admin untuk informasi lebih lanjut._')
    
    console.log('Showing catalog with', db.length, 'items')
    
    let sections = {}
    db.forEach((item, i) => {
        const kategori = item.kategori || 'UNCATEGORIZED'
        if (!sections[kategori]) sections[kategori] = []
        
        let cost = getFinalPrice(item.harga_jual)
        
        sections[kategori].push(`│ ${i + 1}. ${item.nama_barang}\n│    ╰ ${formatIDR(cost.total)} | Stok: ${item.stok} ${item.satuan}`)
    })

    let menuToko = `🏪 *WELCOME TO ACAMEDIA*\n\n`
    for (let kat in sections) {
        menuToko += `┏──『 *${kat.toUpperCase()}* 』\n`
        menuToko += sections[kat].join('\n')
        menuToko += `\n┗───────────────\n\n`
    }
    menuToko += `📋 *Total Produk:* ${db.length} item\n\n`
    menuToko += `👉 Ketik *.store [nomor]* untuk detail produk\n`
    menuToko += `👉 Ketik *.store [nama]* untuk mencari produk\n`
    menuToko += `👉 Ketik *.beli [nomor]* untuk checkout`

    if (isOwner) {
        menuToko += `\n\n🛠️ *Admin Commands:*\n`
        menuToko += `• .store add nama|kategori|harga|stok|satuan|kode\n`
        menuToko += `• .store del [nomor]\n`
        menuToko += `• .store update [nomor] [field] [value]\n`
        menuToko += `• .store list`
    }

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
    } catch (e) {
        console.error('Error checking status:', e)
        return null
    }
}

handler.help = ['store', 'beli']
handler.tags = ['shop']
handler.command = /^(store|toko|beli|menu|start|help)$/i

export default handler
