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
        if (!msg.message) return;

        if (msg.message.protocolMessage && msg.message.protocolMessage.type === 0) return;
        
        const sender = msg.key.remoteJid;
        if (msg.message.reactionMessage) return;

        let text = '';
        
        if (msg.message.editedMessage) {
            text = msg.message.editedMessage.message.protocolMessage.editedMessage.conversation || 
                   msg.message.editedMessage.message.protocolMessage.editedMessage.extendedTextMessage?.text;
        }
        else if (msg.message.conversation) text = msg.message.conversation;
        else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
        else if (msg.message.stickerMessage) text = '[ستيكر]';
        else if (msg.message.imageMessage) text = '[صورة]';
        else if (msg.message.audioMessage) text = '[رسالة صوتية]';
        else if (msg.message.videoMessage) text = '[فيديو]';
        else if (msg.message.documentMessage) text = '[مستند]';
        else if (msg.message.locationMessage) text = '[موقع]';
        else if (msg.message.contactMessage) text = '[جهة اتصال]';
        else text = '[رسالة غير مفهومة أو رمز]';

        if (!text || text.trim() === '') {
            text = '[رسالة فارغة أو رمز]';
        }

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

        // ردود سريعة
        if (lowerText.includes('الوقت') || lowerText.includes('الساعة') || lowerText.includes('كم الساعة')) {
            await sock.sendMessage(sender, { text: `🕒 الوقت الآن هو: ${new Date().toLocaleTimeString('ar-EG')}` });
            return;
        }
        if (lowerText === 'السلام عليكم' || lowerText === 'سلام' || lowerText === 'هلا' || lowerText === 'مرحبا') {
            await sock.sendMessage(sender, { text: 'وعليكم السلام ورحمة الله وبركاته 🌟 كيفنك؟ أنا بوت الدلفري بتاع عبدالرحمن.' });
            return;
        }

        // ===== الذكاء الاصطناعي مع قائمة الأسعار المحددة =====
        try {
            console.log('📩 رسالة جديدة:', text);
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: 'system', 
                        content: `أنت شاب سوداني ودود جداً وخفيف الدم، بتشتغل في مطعم وتوصيل الطلبات في الحلة، صاحب الشغل اسمه عبدالرحمن. 
رد على أي رسالة تصل إليك باللهجة السودانية، حتى لو كانت حروفاً عشوائية أو مجرد نقطة (.) أو إيموجي. ممنوع تماماً أن تقول "لا أستطيع المساعدة" أو ترجع رد فارغ.

إذا سألك أي شخص عن الأسعار، المنيو، أو تكلفة أي طلب، يجب عليك الالتزام بهذه الأسعار الرسمية حرفياً (لا تخترع أسعاراً أخرى أبداً):
🍕 البيتزا الصغيرة: 20,000 جنيه
🍕 البيتزا الوسط: 25,000 جنيه
🍕 البيتزا الكبيرة: 30,000 جنيه
🥟 الفطائر: 12,000 جنيه
🛵 التوصيل: 5,000 جنيه

إذا سألك عن شيء غير موجود في القائمة، اعتذر بلطف وقول ليه: "والله ما عندنا الحاجة دي، بس ممكن تتواصل مع عبدالرحمن وهو يفيدك أكثر". كن طبيعياً، لطيفاً، ومختصراً في ردودك.` 
                    },
                    { role: 'user', content: text }
                ],
                model: 'openai/gpt-oss-20b',
                temperature: 0.7, // خفضناها شوية عشان يلتزم بالأسعار وما يخترعش
                max_tokens: 200,
            });

            let reply = chatCompletion.choices[0]?.message?.content;
            
            if (!reply || reply.trim().length === 0) {
                const fallbacks = [
                    "يا زول رسالتك دي ما فهمتها 😂 عايز توصيل ولا بتجرب البوت؟",
                    "شنو يا معلم؟ مالك ساكت؟ 😅",
                    "أها، عايز توصيل حاجة ولا شنو؟ 🛵",
                    "حاضرين يا زول، قول لي محتاج شنو بالضبط؟ 🌟"
                ];
                reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            }

            await sock.sendMessage(sender, { text: reply.trim() });
            
        } catch (error) {
            console.error('❌ Groq Error:', error.message || error);
            await sock.sendMessage(sender, { text: 'يا زول والله الإنترنت عندي قطع شوية، عيد رسالتك تاني الله يخليك 😂🙏' });
        }
    });
}

startBot();