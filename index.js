const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const http = require('http');
const Groq = require('groq-sdk');

// تأكد أن المفتاح يقرأ من Render
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot is running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Web server is listening on port ${PORT}`);
});

// دالة وقت المدرسة (الأحد - الخميس، 7ص - 2م)
function isSchoolTime() {
    const now = new Date();
    const sudanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Khartoum' }));
    const day = sudanTime.getDay();
    if (day === 5 || day === 6) return false; // الجمعة والسبت إجازة
    const hours = sudanTime.getHours();
    const minutes = sudanTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes >= (7 * 60) && totalMinutes < (14 * 60);
}

let globalBotOff = false;
const mutedChats = new Set();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: 'silent' })
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = '249906754454';
        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log('🔑 رمز الاقتران:', code);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ البوت متصل بنجاح!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // أوامر التحكم الخاصة بك
        if (msg.key.fromMe && text) {
            const cmd = text.trim();
            if (cmd === 'ايقاف الكل' || cmd === 'إيقاف الكل' || cmd === 'توقف الكل') { globalBotOff = true; return; }
            if (cmd === 'تشغيل الكل' || cmd === 'شغل الكل') { globalBotOff = false; mutedChats.clear(); return; }
            if (cmd === 'ايقاف' || cmd === 'إيقاف' || cmd === 'توقف' || cmd === 'وقف') { mutedChats.add(sender); return; }
            if (cmd === 'تشغيل' || cmd === 'شغل') { mutedChats.delete(sender); return; }
            return;
        }

        if (globalBotOff || mutedChats.has(sender) || !text) return;

        // وقت المدرسة
        if (isSchoolTime()) { 
            await sock.sendMessage(sender, { text: 'عبدالرحمن في المدرسة' }); 
            return; 
        }

        // الذكاء الاصطناعي (Groq)
        try {
            console.log('📩 رسالة جديدة للذكاء الاصطناعي:', text);
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: 'system', 
                        content: 'أنت مساعد ذكي لتوصيل الطلبات في الحلة، السودان. تجيب باللهجة السودانية، وترد على أي سؤال عن الأسعار، العناوين، والطلبات. صاحب العمل اسمه عبدالرحمن. كن لطيفاً ومختصراً.' 
                    },
                    { role: 'user', content: text }
                ],
                model: 'openai/gpt-oss-20b', // تم تحديث الموديل هنا
                temperature: 0.7,
                max_tokens: 150,
            });

            const reply = chatCompletion.choices[0]?.message?.content;
            if (reply) {
                await sock.sendMessage(sender, { text: reply.trim() });
            }
        } catch (error) {
            console.error('❌ Groq Error:', error.message || error);
            await sock.sendMessage(sender, { text: '⏳ سيرد عليك عبدالرحمن عندما يدخل واتساب إن شاء الله.' });
        }
    });
}

startBot();