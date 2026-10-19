const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    AuditLogEvent, 
    PermissionsBitField 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

// ⚙️ الإعدادات العامة (أدخل الآيديات الخاصة بك هنا)
const CONFIG = {
    OWNER_ID: "ضع_آيدي_المالك_هنا",       // آيدي حسابك في ديسكورد
    LOG_CHANNEL_ID: "ضع_آيدي_روم_اللوق",  // آيدي روم اللوقات
    PREFIX_LESS: true                     // تشغيل بدون بريفكس
};

// خريطة لتتبع حماية السبام والروابط
const spamMap = new Map();

client.once('ready', () => {
    console.log(`[Y7 PROTECTION] Full System Ready as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'Y7 Security | 24/7 Shield', type: 3 }],
        status: 'dnd'
    });
});

// 🛑 1. نظام Anti-Bot (منع إضافة البوتات غير المصرحة)
client.on('guildMemberAdd', async (member) => {
    if (!member.user.bot) return;

    const guild = member.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd }).catch(() => null);
    const botLog = fetchedLogs?.entries.first();

    if (botLog) {
        const { executor } = botLog;
        if (executor.id !== CONFIG.OWNER_ID && executor.id !== guild.ownerId) {
            // طرد البوت
            await member.kick('Y7 Guard: Unauthorized Bot Addition').catch(() => {});
            
            // سحب رتب الشخص الذي أضاف البوت
            const executorMember = await guild.members.fetch(executor.id).catch(() => null);
            if (executorMember) await executorMember.roles.set([]).catch(() => {});

            // إرسال تنبيه باللوق
            sendLog(guild, '🚨 Anti-Bot Triggered', `تم طرد البوت <@${member.id}> وسحب رتب الشخص الذي أضافه: <@${executor.id}>`, '#FF0000');
        }
    }
});

// 🛡️ 2. نظام Anti-Nuke (سحب رتب الإداري فور التخريب)
client.on('roleDelete', async (role) => handleAntiNuke(role.guild, AuditLogEvent.RoleDelete, 'مسح رتبة'));
client.on('channelDelete', async (channel) => handleAntiNuke(channel.guild, AuditLogEvent.ChannelDelete, 'مسح روم'));

async function handleAntiNuke(guild, actionType, actionName) {
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: actionType }).catch(() => null);
    const log = fetchedLogs?.entries.first();
    if (!log) return;

    const { executor } = log;
    if (executor.id === CONFIG.OWNER_ID || executor.id === guild.ownerId || executor.id === client.user.id) return;

    const executorMember = await guild.members.fetch(executor.id).catch(() => null);
    if (executorMember) {
        // تجريد الإداري من جميع رتبه فوراً
        await executorMember.roles.set([]).catch(() => {});

        sendLog(guild, '🚨 ANTI-NUKE SYSTEM', `محاولة تخريب من الإداري: <@${executor.id}>\nالحدث: **${actionName}**\n**الإجراء:** تم سحب جميع رتبه بنجاح لحماية السيرفر.`, '#000000');
        
        // تنبيه خاص للمالك
        const owner = await client.users.fetch(CONFIG.OWNER_ID).catch(() => null);
        if (owner) {
            owner.send(`⚠️ **تنبيه عاجل من Y7 Protection:**\nتم رصد محاولة تخريب في سيرفر **${guild.name}** بواسطة <@${executor.id}> وتم تجريده من صلاحياته!`).catch(() => {});
        }
    }
}

// 💬 3. الأوامر المباشرة + حماية السبام والروابط (Anti-Link & Anti-Spam)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const isOwner = message.author.id === CONFIG.OWNER_ID || message.author.id === message.guild.ownerId;
    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);

    // --- حماية الروابط ---
    if (!isAdmin && !isOwner) {
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`❌ | يمنع نشر الروابط يا <@${message.author.id}>!`).then(m => setTimeout(() => m.delete(), 4000));
        }

        // --- حماية السبام ---
        const userData = spamMap.get(message.author.id) || { count: 0, timer: null };
        userData.count++;
        if (userData.count >= 5) {
            await message.member.timeout(5 * 60 * 1000, 'Y7 Anti-Spam').catch(() => {});
            message.channel.send(`🤫 | تم إعطاء تايم 5 دقائق لـ <@${message.author.id}> بسبب التكرار والسبام.`);
            spamMap.delete(message.author.id);
            return;
        }
        if (!userData.timer) {
            userData.timer = setTimeout(() => spamMap.delete(message.author.id), 5000);
        }
        spamMap.set(message.author.id, userData);
    }

    // --- الأوامر المباشرة ---
    const args = message.content.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (command === 'اص' && (isAdmin || isOwner)) {
        if (!target) return message.reply('❌ | حدد العضو.');
        await target.timeout(60 * 1000, 'Y7 Mute').then(() => message.react('✅')).catch(() => message.reply('❌ | تعذر التنفيذ.'));
    }

    if (command === 'تكلم' && (isAdmin || isOwner)) {
        if (!target) return message.reply('❌ | حدد العضو.');
        await target.timeout(null, 'Y7 Unmute').then(() => message.react('✅')).catch(() => message.reply('❌ | تعذر التنفيذ.'));
    }

    if (command === 'باند' && (isAdmin || isOwner)) {
        if (!target) return message.reply('❌ | حدد العضو.');
        await target.ban({ reason: 'Y7 Protection Ban' }).then(() => message.react('✅')).catch(() => message.reply('❌ | تعذر التنفيذ.'));
    }

    if (command === 'فك' && (isAdmin || isOwner)) {
        const userId = args[0];
        if (!userId) return message.reply('❌ | اكتب آيدي العضو.');
        await message.guild.members.unban(userId).then(() => message.react('✅')).catch(() => message.reply('❌ | الآيدي غير صحيح أو غير مبند.'));
    }

    if (command === 'تايم' && (isAdmin || isOwner)) {
        if (!target) return message.reply('❌ | حدد العضو.');
        const timeArg = args[1] || '10m';
        let ms = 10 * 60 * 1000;
        if (timeArg.endsWith('m')) ms = parseInt(timeArg) * 60 * 1000;
        if (timeArg.endsWith('h')) ms = parseInt(timeArg) * 60 * 60 * 1000;

        await target.timeout(ms, 'Y7 Timeout').then(() => message.react('✅')).catch(() => message.reply('❌ | تعذر التنفيذ.'));
    }

    if (command === 'فك_التايم' && (isAdmin || isOwner)) {
        if (!target) return message.reply('❌ | حدد العضو.');
        await target.timeout(null, 'Y7 Remove Timeout').then(() => message.react('✅')).catch(() => message.reply('❌ | تعذر التنفيذ.'));
    }
});

// 📊 دالة إرسال اللوق الفخم (أزرق وأسود)
function sendLog(guild, title, description, color = '#0055FF') {
    const logChannel = guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: 'Y7 Protection Systems' })
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
}

client.login(process.env.DISCORD_TOKEN);
