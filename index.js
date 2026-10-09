// 1. ردود الترحيب (تشمل أي رسالة فيها كلمة سلام أو هلا أو مرحبا)
if (text.includes('السلام') || text.includes('هلا') || text.includes('مرحبا') || text.includes('hi')) {
    await sock.sendMessage(sender, { text: 'وعليكم السلام ورحمة الله وبركاته! أنا بوت واتساب، كيف يمكنني مساعدتك؟' });
} 
// 2. رد الوقت
else if (text === 'الوقت') {
    await sock.sendMessage(sender, { text: `الوقت الآن هو: ${new Date().toLocaleTimeString()}` });
} 
// 3. رد افتراضي على أي رسالة أخرى (مثل: كيف حالك، وين انت)
else {
    await sock.sendMessage(sender, { text: 'أهلاً بك! أنا بوت رد آلي. اكتب "السلام عليكم" أو "الوقت" للتجربة.' });
}