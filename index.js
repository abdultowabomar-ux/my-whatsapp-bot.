const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const Groq = require("groq-sdk");
const pino = require('pino');

const groq = new Groq({ apiKey: "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" });
const OWNER_NUMBER = "201202763155"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // سنستخدم كود الربط بدلاً من الـ QR
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- منطق كود الربط (للاستضافة الخارجية) ---
    if (!sock.authState.creds.registered) {
        console.log("🚀 جاري طلب كود الربط لرقمك...");
        setTimeout(async () => {
            let code = await sock.requestPairingCode(OWNER_NUMBER);
            console.log(`\n🔑 كود الربط الخاص بك هو: ${code}\n`);
            console.log("افتح واتساب > الأجهزة المرتبطة > ربط جهاز > الربط برقم الهاتف وضع الكود.");
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    // إعادة الاتصال التلقائي في حال السقوط
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'close') startBot();
        if (connection === 'open') console.log('✅ البوت متصل الآن من السيرفر!');
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const remoteJid = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const quote = { quoted: msg };

        // الرد التعريفي الخاص بك
        if (text.includes("السلام عليكم") || text === "سلام") {
            const welcomeText = `وعليكم السلام.. 🛡️\n\nالبوت ده أنا اللي مصممه وبيرد تلقائي. يمكن تشرح مشكلتك وإن شاء الله راجع الإرشاد بعدين.\n\nالكتالوج: https://wa.me/c/246406954664078`;
            return await sock.sendMessage(remoteJid, { text: welcomeText }, quote);
        }

        // الرد الذكي للطلبات الأخرى
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "system", content: "أنت مساعد خبير سيبراني." }, { role: "user", content: text }],
                model: "llama-3.3-70b-versatile",
            });
            await sock.sendMessage(remoteJid, { text: completion.choices[0].message.content }, quote);
        } catch (e) { console.log(e.message); }
    });
}
startBot();
