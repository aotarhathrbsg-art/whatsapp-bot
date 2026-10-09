const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const http = require('http');

// سيرفر ويب بسيط لإرضاء Render و UptimeRobot
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot is running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Web server is listening on port ${PORT}`);
});

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
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const sender = msg.key.remoteJid;
        if (!text) return;

        const lowerText = text.toLowerCase();

        // 1. السلام والترحيب
        if (lowerText.includes('السلام') || lowerText.includes('هلا') || lowerText.includes('مرحبا') || lowerText.includes('hi')) {
            await sock.sendMessage(sender, { text: 'وعليكم السلام ورحمة الله وبركاته 🌟 كيفنك؟ أنا بوت الدلفري بتاع عبدالرحمن.' });
        } 
        // 2. الأخبار وكيف الحال
        else if (lowerText.includes('أخبار') || lowerText.includes('اخبار') || lowerText.includes('كويس') || lowerText.includes('كيف حالك') || lowerText.includes('كيفنك') || lowerText.includes('شلونك') || lowerText.includes('كيفك')) {
            await sock.sendMessage(sender, { text: 'الحمدلله تمام، أخبارك انت؟ 😊' });
        } 
        // 3. وين انت
        else if (lowerText.includes('وين') || lowerText.includes('فين')) {
            await sock.sendMessage(sender, { text: 'أنا في الحلة، وين تريد التوصيل؟ 📍' });
        } 
        // 4. الطلبات والدلفري
        else if (lowerText.includes('طلب') || lowerText.includes('توصيل') || lowerText.includes('دلفري') || lowerText.includes('عايز') || lowerText.includes('ابغى')) {
            await sock.sendMessage(sender, { text: 'خلاص بوصل ليك إن شاء الله 🛵. ابعت لي: الاسم، العنوان، رقم الهاتف، والطلب.' });
        } 
        // 5. السعر
        else if (lowerText.includes('سعر') || lowerText.includes('كم')) {
            await sock.sendMessage(sender, { text: 'التوصيل حسب المنطقة، قول لي وين بالضبط وأنا أقول ليك السعر. 💰' });
        } 
        // 6. انت منو
        else if (lowerText.includes('انت') || lowerText.includes('منو')) {
            await sock.sendMessage(sender, { text: 'أنا بوت مساعد بتاع عبدالرحمن للدلفري في الحلة. 🛵' });
        } 
        // 7. أي رسالة تانية
        else {
            await sock.sendMessage(sender, { text: 'انتظر عبدالرحمن، حيرد عليك حالاً. ⏳' });
        }
    });
}

startBot();