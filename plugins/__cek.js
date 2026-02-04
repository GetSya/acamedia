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
        // Menggunakan maybeSingle() untuk menghindari error saat tidak ada data
        const { data, error } = await supabase
            .from('master_data')
            .select('daftar_item')
            .eq('user_id', USER_ID)
            .maybeSingle() // Changed from .single()
        
        if (error) {
            console.error('Error loading from Supabase:', error)
            return []
        }
        
        // Jika data null (tidak ada row), return array kosong
        // Jika ada row, return daftar_item atau array kosong jika null
        return data?.daftar_item || []
    } catch (error) {
        console.error('Error in loadDB:', error)
        return []
    }
}

const saveDB = async (data) => {
    try {
        // Cek apakah row untuk user_id ini sudah ada
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
            // Jika row sudah ada, update
            result = await supabase
                .from('master_data')
                .update({ 
                    daftar_item: data,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', USER_ID)
        } else {
            // Jika row belum ada, insert baru
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
    let db = await loadDB() // Pastikan await karena loadDB async
    let args = text.trim().split(/ +/)
    let subCommand = args[0] ? args[0].toLowerCase() : ''

    // ==========================================
    // LOGIKA OWNER (CRUD)
    // ==========================================
    if (subCommand === 'add' && isOwner) {
        let input = text.split('add')[1]?.split('|').map(v => v.trim())
        if (!input || input.length < 6) return m.reply(`*Format Owner (Add):*\n${usedPrefix}store add Nama|Kategori|Deskripsi|Harga|Promo(Kosongkan jika tak ada)|Durasi|Varian`)
        
        let [nama, kategori, deskripsi, harga, promo, durasi, varian] = input
        
        // Buat item baru dengan format lengkap untuk Supabase
        const newItem = {
            id: Date.now().toString(),
            nama_barang: nama,
            kategori: kategori,
            deskripsi: deskripsi || '-',
            harga_jual: parseInt(harga.replace(/\D/g, '')),
            promo: promo ? parseInt(promo.replace(/\D/g, '')) : 0,
            durasi: durasi || '-',
            varian: varian || '-',
            stok: 999,
            satuan: "Pcs",
            harga_beli: 0,
            kode_barang: ""
        }
        
        db.push(newItem)
        const success = await saveDB(db)
        if (success) {
            return m.reply(`✨ *Produk "${nama}" Berhasil Disimpan ke Database!*\nID: ${newItem.id}`)
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
                return m.reply(`🗑️ *"${removed[0].nama_barang}" berhasil dihapus dari database.*`)
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
            listText += `   🏷️ Promo: ${item.promo > 0 ? formatIDR(item.promo) : 'Tidak'}\n`
            listText += `   📊 Stok: ${item.stok}\n`
            listText += `   ──────────────\n`
        })
        return m.reply(listText)
    }

    // ==========================================
    // LOGIKA USER (PEMBAYARAN/BELI)
    // ==========================================
    if (command === 'beli' || subCommand === 'buy') {
        let index = parseInt(command === 'beli' ? args[0] : args[1]) - 1
        let item = db[index]
        if (!item) return m.reply(`❌ Produk tidak ditemukan.\n*Pilih produk:* .beli 1\n*Lihat produk:* .store`)

        // Kurangi stok jika tersedia
        if (item.stok <= 0) {
            return m.reply('❌ Maaf, stok produk ini habis.')
        }
        
        let hrg = item.promo > 0 ? item.promo : item.harga_jual
        let cost = getFinalPrice(hrg)
        
        await m.reply('🔄 *Menyiapkan QRIS Aktif...*')

        try {
            const res = await createQris(cost.total, item.nama_barang)
            let exp = new Date(Date.now() + (SETTINGS.expired * 60000))

            let caption = `┌───〔 *PEMBAYARAN* 〕───\n`
            caption += `│ 📦 *Item:* ${item.nama_barang}\n`
            caption += `│ 📦 *Kategori:* ${item.kategori}\n`
            caption += `│ 💰 *Harga:* ${formatIDR(cost.base)}\n`
            caption += `│ 🧾 *Biaya Admin:* ${formatIDR(cost.tax)}\n`
            caption += `│ 📉 *Promo:* ${item.promo > 0 ? 'Aktif' : 'Tidak'}\n`
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
                    
                    m.reply(`✅ *ORDER SUKSES!*\n\nPembayaran untuk *${item.nama_barang}* senilai *${formatIDR(cost.total)}* telah kami terima.\nStok tersisa: ${item.stok}\n\n_Mohon hubungi Owner segera._`)
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
    
    // Logika Pintar: Jika ketik ".store 1" atau ".store netflix"
    if (subCommand && subCommand !== 'add' && subCommand !== 'del' && subCommand !== 'list') {
        let item
        if (!isNaN(subCommand)) {
            item = db[parseInt(subCommand) - 1] // Berdasarkan Angka
        } else {
            item = db.find(v => v.nama_barang.toLowerCase().includes(subCommand)) // Berdasarkan Pencarian Kata
        }

        if (item) {
            let hrg = item.promo > 0 ? item.promo : item.harga_jual
            let p = getFinalPrice(hrg)
            let textDetail = `🔖 *INFO PRODUK*\n\n`
            textDetail += `🏷️ *${item.nama_barang}*\n`
            textDetail += `📦 *Kategori:* ${item.kategori}\n`
            textDetail += `⏳ *Durasi:* ${item.durasi || '-'}\n`
            textDetail += `📋 *Varian:* ${item.varian || '-'}\n`
            textDetail += `📊 *Stok:* ${item.stok || 0} ${item.satuan || ''}\n\n`
            textDetail += `📝 *Keterangan:* \n${item.deskripsi || '-'}\n\n`
            textDetail += `💰 *Harga Normal:* ${formatIDR(item.harga_jual)}\n`
            if (item.promo > 0) {
                textDetail += `💰 *Harga Promo:* ${formatIDR(item.promo)}\n`
            }
            textDetail += `🧾 *Biaya Admin:* ${formatIDR(p.tax)}\n`
            textDetail += `🏦 *TOTAL BAYAR:* *${formatIDR(p.total)}*\n`
            textDetail += `_(Termasuk PPN & Admin)_\n\n`
            textDetail += `🛒 Ketik *.beli ${db.indexOf(item) + 1}* untuk membeli`
            return m.reply(textDetail)
        }
    }

    // CATALOG UTAMA
    if (db.length === 0) return m.reply('🏪 *TOKO KOSONG*\n\nBelum ada produk yang tersedia saat ini.\n\n_Mohon hubungi admin untuk informasi lebih lanjut._')
    
    let sections = {}
    db.forEach((v, i) => {
        if (!sections[v.kategori]) sections[v.kategori] = []
        let hrg = v.promo > 0 ? v.promo : v.harga_jual
        let p = getFinalPrice(hrg)
        let promoBadge = v.promo > 0 ? '🔥 ' : ''
        sections[v.kategori].push(`│ ${i + 1}. ${promoBadge}${v.nama_barang} \n│    ╰ ${formatIDR(p.total)} (Stok: ${v.stok})`)
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
        menuToko += `• .store add [data]\n`
        menuToko += `• .store del [nomor]\n`
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
