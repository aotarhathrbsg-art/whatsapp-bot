const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

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

        if (text.includes('السلام') || text.includes('هلا') || text.includes('مرحبا') || text.includes('hi')) {
            await sock.sendMessage(sender, { text: 'وعليكم السلام ورحمة الله وبركاته! أنا بوت واتساب، كيف يمكنني مساعدتك؟' });
        } else if (text === 'الوقت') {
            await sock.sendMessage(sender, { text: `الوقت الآن هو: ${new Date().toLocaleTimeString()}` });
        } else if (text.includes('كيف حالك') || text.includes('كيفك') || text.includes('وين انت') || text.includes('وينك')) {
            await sock.sendMessage(sender, { text: 'أنا بخير، شكراً لسؤالك! أنا هنا لخدمتك في أي وقت. 😊' });
        } else {
            await sock.sendMessage(sender, { text: 'أهلاً بك! أنا بوت رد آلي. اكتب "السلام عليكم" أو "الوقت" للتجربة.' });
        }
    });
}
startBot();