"use strict";
/**
 * @lynnidoffc/baileys — MessageBuilder
 * Button, ButtonV2, Carousel, AIRich, Toolkit, Location, Quick Reply, URL, Call, List
 * 
 * Usage:
 *   const { MessageBuilder } = require('baileys')
 *   const msg = MessageBuilder.button(...)
 *   await sock.sendMessage(jid, msg)
 */

// ─── Button helpers ──────────────────────────────────────────────────────────

/**
 * Quick-reply button (native flow)
 * @param {string} displayText  Label yang tampil
 * @param {string} id           ID yang dikirim balik ke bot (default = displayText)
 */
function quickReplyBtn(displayText, id) {
    return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: displayText, id: id || displayText })
    };
}

/**
 * URL button — opens URL in browser
 */
function urlBtn(displayText, url) {
    return {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ display_text: displayText, url, merchant_url: url })
    };
}

/**
 * Copy button — copies text to clipboard
 */
function copyBtn(displayText, copyCode) {
    return {
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({ display_text: displayText, copy_code: copyCode })
    };
}

/**
 * Call button — initiates phone call
 */
function callBtn(displayText, phoneNumber) {
    return {
        name: 'cta_call',
        buttonParamsJson: JSON.stringify({ display_text: displayText, phone_number: phoneNumber })
    };
}

/**
 * Location button — opens location picker
 */
function locationBtn(displayText) {
    return {
        name: 'send_location',
        buttonParamsJson: JSON.stringify({ display_text: displayText })
    };
}

/**
 * Address button — opens address input
 */
function addressBtn(displayText) {
    return {
        name: 'address_message',
        buttonParamsJson: JSON.stringify({ display_text: displayText, saved_address_types: ['HOME', 'WORK'] })
    };
}

// ─── MessageBuilder class ────────────────────────────────────────────────────

class MessageBuilder {
    /**
     * Button (native-flow interactiveMessage)
     * 
     * @param {object} opts
     * @param {string}  opts.body       Teks utama pesan
     * @param {string}  [opts.footer]   Teks footer
     * @param {object}  [opts.header]   { title, image, video, document }
     * @param {Array}   opts.buttons    Array dari quickReplyBtn/urlBtn/dll
     * @param {object}  [opts.quoted]   Quoted message
     * 
     * @example
     * const msg = MessageBuilder.button({
     *   body: 'Pilih menu:',
     *   footer: 'Bot Lynn',
     *   buttons: [
     *     MessageBuilder.btn.quickReply('Menu 1', 'menu_1'),
     *     MessageBuilder.btn.url('Website', 'https://lynnoffc.me'),
     *     MessageBuilder.btn.copy('Copy Kode', 'KODE123'),
     *   ]
     * })
     * await sock.sendMessage(jid, msg)
     */
    static button(opts = {}) {
        const { body = '', footer = '', header = {}, buttons = [], contextInfo, quoted } = opts;
        const interactiveMessage = {
            body: { text: body },
            footer: { text: footer },
            header: {
                title: header.title || '',
                hasMediaAttachment: !!(header.image || header.video || header.document)
            },
            nativeFlowMessage: { buttons }
        };
        if (contextInfo) interactiveMessage.contextInfo = contextInfo;
        return { interactiveMessage };
    }

    /**
     * ButtonV2 — alias Button dengan API yang lebih verbose
     * Sama dengan button() tapi nama berbeda untuk kompatibilitas elaina-baileys
     */
    static buttonV2(opts = {}) {
        return MessageBuilder.button(opts);
    }

    /**
     * List message (menu pilihan)
     * 
     * @param {object} opts
     * @param {string}  opts.title      Judul list
     * @param {string}  opts.body       Teks body
     * @param {string}  [opts.footer]   Footer
     * @param {string}  opts.buttonText Teks tombol list
     * @param {Array}   opts.sections   Array section: [{ title, rows: [{ title, rowId, description }] }]
     * 
     * @example
     * const msg = MessageBuilder.list({
     *   title: 'Menu Bot',
     *   body: 'Pilih menu di bawah:',
     *   footer: 'Lynn Bot',
     *   buttonText: 'Lihat Menu',
     *   sections: [{
     *     title: 'Fitur Utama',
     *     rows: [
     *       { title: 'Info Bot', rowId: 'info', description: 'Lihat info bot' },
     *       { title: 'Help', rowId: 'help', description: 'Bantuan' },
     *     ]
     *   }]
     * })
     */
    static list(opts = {}) {
        const { title = '', body = '', footer = '', buttonText = 'Pilih', sections = [], contextInfo } = opts;
        const listMessage = {
            title,
            description: body,
            footerText: footer,
            listType: 1,
            buttonText,
            sections
        };
        if (contextInfo) listMessage.contextInfo = contextInfo;
        return { listMessage };
    }

    /**
     * Carousel — multiple cards scrollable horizontally
     * 
     * @param {object} opts
     * @param {string}  opts.body    Teks utama
     * @param {string}  [opts.footer] Footer
     * @param {Array}   opts.cards   Array card: [{ header: { image/video }, body, footer, buttons }]
     * 
     * @example
     * const msg = MessageBuilder.carousel({
     *   body: 'Pilih produk:',
     *   cards: [
     *     {
     *       header: { title: 'Produk A' },
     *       body: 'Harga: Rp 50.000',
     *       footer: 'Tersedia',
     *       buttons: [ MessageBuilder.btn.quickReply('Beli', 'beli_a') ]
     *     },
     *     {
     *       header: { title: 'Produk B' },
     *       body: 'Harga: Rp 75.000',
     *       buttons: [ MessageBuilder.btn.url('Detail', 'https://lynnoffc.me') ]
     *     }
     *   ]
     * })
     */
    static carousel(opts = {}) {
        const { body = '', footer = '', cards = [], contextInfo } = opts;
        const carouselCards = cards.map(card => ({
            header: {
                title: card.header?.title || '',
                hasMediaAttachment: !!(card.header?.image || card.header?.video),
                ...(card.header?.image ? { imageMessage: card.header.image } : {}),
                ...(card.header?.video ? { videoMessage: card.header.video } : {})
            },
            body: { text: card.body || '' },
            footer: { text: card.footer || '' },
            nativeFlowMessage: { buttons: card.buttons || [] }
        }));
        const carouselMessage = {
            body: { text: body },
            footer: { text: footer },
            carouselCards
        };
        if (contextInfo) carouselMessage.contextInfo = contextInfo;
        return { carouselMessage };
    }

    /**
     * Location pesan — kirim lokasi
     * 
     * @param {object} opts
     * @param {number}  opts.lat        Latitude
     * @param {number}  opts.lng        Longitude
     * @param {string}  [opts.name]     Nama lokasi
     * @param {string}  [opts.address]  Alamat
     * 
     * @example
     * await sock.sendMessage(jid, MessageBuilder.location({ lat: -6.2, lng: 106.8, name: 'Jakarta' }))
     */
    static location(opts = {}) {
        const { lat = 0, lng = 0, name = '', address = '' } = opts;
        return {
            location: {
                degreesLatitude: lat,
                degreesLongitude: lng,
                name,
                address
            }
        };
    }

    /**
     * AIRich — experimental rich response builder
     * Lihat RichResponse class di bawah
     */
    static aiRich() {
        return new RichResponseBuilder();
    }

    /**
     * Toolkit helper — shortcut untuk buat berbagai jenis pesan
     */
    static get toolkit() {
        return {
            /**
             * Buat pesan teks biasa
             */
            text(text, options = {}) {
                return { text, ...options };
            },
            /**
             * Buat pesan gambar
             */
            image(source, caption = '') {
                const img = typeof source === 'string' ? { url: source } : source;
                return { image: img, caption };
            },
            /**
             * Buat pesan video
             */
            video(source, caption = '') {
                const vid = typeof source === 'string' ? { url: source } : source;
                return { video: vid, caption };
            },
            /**
             * Buat pesan audio
             */
            audio(source, ptt = false) {
                const aud = typeof source === 'string' ? { url: source } : source;
                return { audio: aud, ptt };
            },
            /**
             * Buat pesan dokumen
             */
            document(source, fileName, mimetype) {
                const doc = typeof source === 'string' ? { url: source } : source;
                return { document: doc, fileName, mimetype };
            },
            /**
             * Buat stiker
             */
            sticker(source) {
                const stk = typeof source === 'string' ? { url: source } : source;
                return { sticker: stk };
            },
            /**
             * Buat reaksi
             */
            react(key, emoji) {
                return {
                    react: { text: emoji, key }
                };
            },
            /**
             * Buat poll
             */
            poll(name, values, selectableCount = 1) {
                return { poll: { name, values, selectableCount } };
            }
        };
    }

    /** Button factory shortcuts */
    static get btn() {
        return {
            quickReply: quickReplyBtn,
            url: urlBtn,
            copy: copyBtn,
            call: callBtn,
            location: locationBtn,
            address: addressBtn
        };
    }
}

// ─── RichResponseBuilder (AIRich) ────────────────────────────────────────────

/**
 * AIRich experimental builder — builder pattern untuk rich response
 * 
 * @example
 * const rich = MessageBuilder.aiRich()
 *   .text('Halo! Ini adalah response AI.')
 *   .code('const x = 1', 'javascript')
 *   .table(['Nama', 'Harga'], [['Item A', '50k'], ['Item B', '75k']])
 *   .suggest('Butuh bantuan lain?', ['Ya', 'Tidak'])
 * 
 * await sock.sendMessage(jid, { text: rich.build() })
 */
class RichResponseBuilder {
    constructor() {
        this._parts = [];
    }

    /** Tambah teks */
    text(content) {
        this._parts.push(content);
        return this;
    }

    /** Tambah code block */
    code(content, language = '') {
        this._parts.push(`\`\`\`${language}\n${content}\n\`\`\``);
        return this;
    }

    /** Tambah inline code */
    inlineCode(content) {
        this._parts.push(`\`${content}\``);
        return this;
    }

    /** Tambah tabel teks (ASCII) */
    table(headers = [], rows = []) {
        const colWidths = headers.map((h, i) =>
            Math.max(h.length, ...rows.map(r => String(r[i] || '').length))
        );
        const separator = colWidths.map(w => '-'.repeat(w + 2)).join('+');
        const headerRow = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('|');
        const dataRows = rows.map(row =>
            row.map((cell, i) => ` ${String(cell).padEnd(colWidths[i])} `).join('|')
        );
        const table = [`|${headerRow}|`, `|${separator}|`, ...dataRows.map(r => `|${r}|`)].join('\n');
        this._parts.push(table);
        return this;
    }

    /** Tambah daftar pilihan saran */
    suggest(prompt, options = []) {
        const suggestions = options.map((o, i) => `  ${i + 1}. ${o}`).join('\n');
        this._parts.push(`${prompt}\n${suggestions}`);
        return this;
    }

    /** Tambah separator baris */
    divider() {
        this._parts.push('─'.repeat(30));
        return this;
    }

    /** Tambah heading */
    heading(text, level = 1) {
        const prefix = '*'.repeat(1); // WA bold
        this._parts.push(`${prefix}${text}${prefix}`);
        return this;
    }

    /** Tambah bold text */
    bold(text) {
        this._parts.push(`*${text}*`);
        return this;
    }

    /** Tambah italic text */
    italic(text) {
        this._parts.push(`_${text}_`);
        return this;
    }

    /** Tambah strikethrough */
    strike(text) {
        this._parts.push(`~${text}~`);
        return this;
    }

    /** Tambah media info */
    media(type, caption = '') {
        this._parts.push(`[${type.toUpperCase()}]${caption ? ' ' + caption : ''}`);
        return this;
    }

    /** Build semua parts jadi string */
    build(separator = '\n\n') {
        return this._parts.join(separator);
    }

    /** Langsung return { text: ... } */
    toMessage(separator = '\n\n') {
        return { text: this.build(separator) };
    }

    toString() {
        return this.build();
    }
}

exports.MessageBuilder = MessageBuilder;
exports.RichResponseBuilder = RichResponseBuilder;

// Button factory exports (untuk destructuring langsung)
exports.quickReplyBtn = quickReplyBtn;
exports.urlBtn = urlBtn;
exports.copyBtn = copyBtn;
exports.callBtn = callBtn;
exports.locationBtn = locationBtn;
exports.addressBtn = addressBtn;

exports.default = MessageBuilder;
