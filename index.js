const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const http = require('http');

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
    const start = 7 * 60;
    const end = 14 * 60;
    return totalMinutes >= start && totalMinutes < end;
}

// لتتبع آخر وقت أرسل فيه عبدالرحمن رسالة في كل محادثة
const lastOwnerActivity = new Map();
const OWNER_ACTIVE_WINDOW = 10 * 60 * 1000; // 10 دقائق

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

        // لو عبدالرحمن (صاحب الرقم) أرسل رسالة → سجل الوقت ولا ترد
        if (msg.key.fromMe) {
            lastOwnerActivity.set(sender, Date.now());
            return;
        }

        // لو عبدالرحمن كان نشط في هذه المحادثة خلال آخر 10 دقائق → لا ترد
        const lastActivity = lastOwnerActivity.get(sender);
        if (lastActivity && (Date.now() - lastActivity) < OWNER_ACTIVE_WINDOW) {
            return; // عبدالرحمن موجود، اسكت
        }

        if (!text) return;
        const lowerText = text.toLowerCase().trim();

        // وقت المدرسة
        if (isSchoolTime()) {
            await sock.sendMessage(sender, { text: 'عبدالرحمن في المدرسة' });
            return;
        }

        // السلام والترحيب
        if (lowerText.includes('سلام') || lowerText.includes('السلام') || lowerText.includes('هلا') || lowerText.includes('مرحبا') || lowerText.includes('هاي') || lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('أهلا') || lowerText.includes('اهلا')) {
            await sock.sendMessage(sender, { text: 'وعليكم السلام ورحمة الله وبركاته 🌟 كيفنك؟ أنا بوت الدلفري بتاع عبدالرحمن.' });
        } 
        // الأخبار وكيف الحال
        else if (lowerText.includes('أخبار') || lowerText.includes('اخبار') || lowerText.includes('أخبارك') || lowerText.includes('اخبارك') || lowerText.includes('كويس') || lowerText.includes('كيف حالك') || lowerText.includes('كيف الحال') || lowerText.includes('كيفنك') || lowerText.includes('شلونك') || lowerText.includes('كيفك') || lowerText.includes('كيف انت') || lowerText.includes('عامل كيف')) {
            await sock.sendMessage(sender, { text: 'الحمدلله تمام، أخبارك انت؟ 😊' });
        } 
        // وين انت
        else if (lowerText.includes('وين') || lowerText.includes('فين') || lowerText.includes('وينك') || lowerText.includes('وين انت') || lowerText.includes('مكانك')) {
            await sock.sendMessage(sender, { text: 'أنا في الحلة، وين تريد التوصيل؟ 📍🛵' });
        } 
        // الطلبات والدلفري
        else if (lowerText.includes('طلب') || lowerText.includes('توصيل') || lowerText.includes('دلفري') || lowerText.includes('عايز') || lowerText.includes('ابغى') || lowerText.includes('أبغى') || lowerText.includes('وصل') || lowerText.includes('أوصل') || lowerText.includes('جيب')) {
            await sock.sendMessage(sender, { text: 'خلاص بوصل ليك إن شاء الله 🛵. ابعت لي: الاسم، العنوان، رقم الهاتف، والطلب.' });
        } 
        // السعر
        else if (lowerText.includes('سعر') || lowerText.includes('كم') || lowerText.includes('بكم') || lowerText.includes('تكلفة')) {
            await sock.sendMessage(sender, { text: 'التوصيل حسب المنطقة 💰، قول لي وين بالضبط وأنا أقول ليك السعر.' });
        } 
        // انت منو
        else if (lowerText.includes('انت') || lowerText.includes('منو') || lowerText.includes('من انت') || lowerText.includes('انتو')) {
            await sock.sendMessage(sender, { text: 'أنا بوت مساعد بتاع عبدالرحمن للدلفري في الحلة 🛵.' });
        } 
        // شكراً
        else if (lowerText.includes('شكرا') || lowerText.includes('شكراً') || lowerText.includes('تسلم') || lowerText.includes('الله يبارك')) {
            await sock.sendMessage(sender, { text: 'العفو 🌟 في أي وقت!' });
        } 
        // مع السلامة
        else if (lowerText.includes('مع السلامة') || lowerText.includes('باي') || lowerText.includes('bye') || lowerText.includes('وداعا')) {
            await sock.sendMessage(sender, { text: 'في رعاية الله 🌟 تشرفنا بخدمتك.' });
        } 
        // أي رسالة تانية
        else {
            await sock.sendMessage(sender, { text: '⏳ سيرد عليك عبدالرحمن عندما يدخل واتساب إن شاء الله.' });
        }
    });
}

startBot();
