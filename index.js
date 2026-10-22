const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const http = require('http');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot is running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Web server is listening on port ${PORT}`);
});

function isSchoolTime() {
    const now = new Date();
    const sudanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Khartoum' }));
    const day = sudanTime.getDay();
    if (day === 5 || day === 6) return false; 
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
        if (!msg.message || msg.message.protocolMessage || msg.message.senderKeyDistributionMessage) return;

        const sender = msg.key.remoteJid;
        
        // تجاهل التفاعلات (الإيموجي اللي بيتحط على الرسائل) عشان ما يردش عليها
        if (msg.message.reactionMessage) return;

        let text = '';
        if (msg.message.conversation) text = msg.message.conversation;
        else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
        else if (msg.message.stickerMessage) text = 'أرسل لي ستيكر';
        else if (msg.message.imageMessage) text = 'أرسل لي صورة';
        else if (msg.message.audioMessage) text = 'أرسل لي رسالة صوتية';
        else if (msg.message.videoMessage) text = 'أرسل لي فيديو';
        else if (msg.message.documentMessage) text = 'أرسل لي مستند';
        else if (msg.message.locationMessage) text = 'أرسل لي موقعه';
        else if (msg.message.contactMessage) text = 'أرسل لي جهة اتصال';
        else text = 'أرسل لي إيموجي أو رسالة غير مفهومة'; // شبكة أمان لأي رسالة غريبة

        if (msg.key.fromMe) {
            const cmd = text.trim();
            if (cmd === 'ايقاف الكل' || cmd === 'إيقاف الكل' || cmd === 'توقف الكل') { globalBotOff = true; return; }
            if (cmd === 'تشغيل الكل' || cmd === 'شغل الكل') { globalBotOff = false; mutedChats.clear(); return; }
            if (cmd === 'ايقاف' || cmd === 'إيقاف' || cmd === 'توقف' || cmd === 'وقف') { mutedChats.add(sender); return; }
            if (cmd === 'تشغيل' || cmd === 'شغل') { mutedChats.delete(sender); return; }
            return; 
        }

        if (globalBotOff || mutedChats.has(sender)) return;

        if (isSchoolTime()) { 
            await sock.sendMessage(sender, { text: 'عبدالرحمن في المدرسة' }); 
            return; 
        }

        const lowerText = text.toLowerCase().trim();

        // ردود سريعة ومباشرة (الوقت والسلام)
        if (lowerText.includes('الوقت') || lowerText.includes('الساعة') || lowerText.includes('كم الساعة')) {
            await sock.sendMessage(sender, { text: `🕒 الوقت الآن هو: ${new Date().toLocaleTimeString('ar-EG')}` });
            return;
        }
        if (lowerText === 'السلام عليكم' || lowerText === 'سلام' || lowerText === 'هلا' || lowerText === 'مرحبا') {
            await sock.sendMessage(sender, { text: 'وعليكم السلام ورحمة الله وبركاته 🌟 كيفنك؟ أنا بوت الدلفري بتاع عبدالرحمن.' });
            return;
        }

        // ===== الذكاء الاصطناعي: يرد على أي شيء =====
        try {
            console.log('📩 رسالة جديدة للذكاء الاصطناعي:', text);
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: 'system', 
                        // تم تعديل التعليمات عشان يرد على أي حاجة وما يسكتش
                        content: 'أنت شاب سوداني ودود جداً وخفيف الدم، بتشتغل في توصيل الطلبات في الحلة، صاحب الشغل اسمه عبدالرحمن. رد على أي رسالة تصل إليك، حتى لو كانت حروفاً عشوائية (زي uu أو u) أو كلمة غير مفهومة. ممنوع تماماً أن تقول "لا أستطيع المساعدة" أو تسكت. إذا كانت الرسالة غير واضحة، رد بضحكة، أو اسأله سؤالاً لطيفاً باللهجة السودانية (زي: مالك يا زول؟ عايز توصيل ولا بتجرب البوت؟). كن طبيعياً ومبدعاً.' 
                    },
                    { role: 'user', content: text }
                ],
                model: 'openai/gpt-oss-20b', // الموديل المستقر
                temperature: 0.9, // رفعنا الإبداع لأقصى درجة عشان يرد بأسلوب مختلف كل مرة
                max_tokens: 150,
            });

            const reply = chatCompletion.choices[0]?.message?.content;
            if (reply) {
                await sock.sendMessage(sender, { text: reply.trim() });
            }
        } catch (error) {
            console.error('❌ Groq Error:', error.message || error);
            // لو حصل خطأ في الشبكة، نرد برد لطيف عشان ما نسكتش
            await sock.sendMessage(sender, { text: 'يا زول والله الإنترنت عندي قطع شوية، عيد رسالتك تاني الله يخليك 😂🙏' });
        }
    });
}

startBot();