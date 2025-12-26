const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const Groq = require("groq-sdk");
const pino = require('pino');
const http = require('http');

// --- حل مشكلة الاستضافة (Koyeb Health Check) ---
// هذا السيرفر الوهمي يمنع Koyeb من إغلاق البوت ويجعله يعمل 24/7 مجاناً
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is Alive!');
}).listen(process.env.PORT || 8000);

const groq = new Groq({ apiKey: "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" });
const OWNER_NUMBER = "201202763155"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, 
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- منطق كود الربط (Pairing Code) ---
    if (!sock.authState.creds.registered) {
        console.log("🚀 جاري طلب كود الربط لرقمك...");
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(OWNER_NUMBER);
                console.log(`\n🔑 كود الربط الخاص بك هو: ${code}\n`);
                console.log("افتح واتساب > الأجهزة المرتبطة > ربط جهاز > الربط برقم الهاتف وضع الكود.");
            } catch (err) {
                console.log("خطأ في طلب الكود، قد يكون الرقم مسجلاً بالفعل أو هناك ضغط على السيرفر.");
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    // إعادة الاتصال التلقائي
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log('🔄 جاري إعادة الاتصال...');
            startBot();
        }
        if (connection === 'open') console.log('✅ البوت متصل الآن بنجاح!');
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const remoteJid = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const quote = { quoted: msg };

        // الرد التعريفي
        if (text.includes("السلام عليكم") || text === "سلام" || text === "هلا") {
            const welcomeText = `وعليكم السلام.. 🛡️\n\nالبوت ده أنا اللي مصممه وبيرد تلقائي باستخدام الذكاء الاصطناعي.\nيمكنك شرح مشكلتك وسأقوم بالرد عليك فوراً.\n\nالكتالوج: https://wa.me/c/246406954664078`;
            return await sock.sendMessage(remoteJid, { text: welcomeText }, quote);
        }

        // الرد الذكي باستخدام Llama 3
        if (text.length > 2) {
            try {
                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "أنت مساعد خبير تقني وسيبراني ترد باختصار وذكاء باللغة العربية." },
                        { role: "user", content: text }
                    ],
                    model: "llama-3.3-70b-versatile",
                });
                await sock.sendMessage(remoteJid, { text: completion.choices[0].message.content }, quote);
            } catch (e) { 
                console.log("خطأ في AI:", e.message); 
            }
        }
    });
}

startBot();
