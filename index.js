const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// --- 1. خادم ويب مصغر للعمل 24/7 على Render بدون تأخير ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Y7 Protection Bot is Running 24/7!'));
app.listen(PORT, () => console.log(`[HTTP] Web server running on port ${PORT}`));

// --- 2. إعدادات بوت الديسكورد والصلاحيات ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildIntegrations,
  ],
});

// إعدادات الحماية والتكرار
const limits = new Map();
const LIMIT_TIME = 10000; // 10 ثواني
const MAX_ACTIONS = 3; // الحد الأقصى للأفعال قبل الباند

function checkRaid(userId, actionType) {
  const key = `${userId}_${actionType}`;
  const userActions = limits.get(key) || [];
  const now = Date.now();
  const recentActions = userActions.filter(timestamp => now - timestamp < LIMIT_TIME);
  recentActions.push(now);
  limits.set(key, recentActions);
  return recentActions.length > MAX_ACTIONS;
}

client.once('ready', () => {
  console.log(`[Y7 PROTECTION] Full System Ready as ${client.user.tag}`);
});

// --- 3. حماية Anti-Bot ---
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) {
    try {
      await member.ban({ reason: '[Y7 Anti-Bot] دخول بوتات غير مصرح بها' });
      console.log(`[Anti-Bot] Banned bot: ${member.user.tag}`);
    } catch (err) {
      console.error('[Anti-Bot Error]', err);
    }
  }
});

// --- 4. حماية Anti-Nuke (حذف الرومات والرتب) ---
client.on('channelDelete', async (channel) => {
  try {
    const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 }); // CHANNEL_DELETE
    const entry = auditLogs.entries.first();
    if (entry && entry.executor && !entry.executor.bot) {
      if (checkRaid(entry.executor.id, 'channel_delete')) {
        const member = await channel.guild.members.fetch(entry.executor.id);
        if (member && member.bannable) {
          await member.ban({ reason: '[Y7 Anti-Nuke] تخطي حد حذف الرومات' });
        }
      }
    }
  } catch (err) {
    console.error('[Anti-Nuke Error]', err);
  }
});

client.on('roleDelete', async (role) => {
  try {
    const auditLogs = await role.guild.fetchAuditLogs({ limit: 1, type: 32 }); // ROLE_DELETE
    const entry = auditLogs.entries.first();
    if (entry && entry.executor && !entry.executor.bot) {
      if (checkRaid(entry.executor.id, 'role_delete')) {
        const member = await role.guild.members.fetch(entry.executor.id);
        if (member && member.bannable) {
          await member.ban({ reason: '[Y7 Anti-Nuke] تخطي حد حذف الرتب' });
        }
      }
    }
  } catch (err) {
    console.error('[Anti-Nuke Error]', err);
  }
});

// --- 5. حماية Anti-Link والأوامر المباشرة ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // 🔴 Anti-Link (منع الروابط)
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  if (linkRegex.test(message.content) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.delete().catch(() => {});
    return message.channel.send(`⚠️ <@${message.author.id}> يمنع إرسال الروابط في هذا السيرفر!`).catch(() => {});
  }

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 🔴 أمر اص (اسكات عضو)
  if (command === 'اص') {
    if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
      return message.reply('❌ ليس لديك صلاحية استخدام هذا الأمر!');
    }
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ يرجى تحديد العضو! مثال: `اص @user`');
    try {
      await target.timeout(10 * 60 * 1000, 'أمر اص من الإدارة');
      message.channel.send(`🔇 تم إسكام ${target.user.tag} لمدة 10 دقائق.`);
    } catch (e) {
      message.reply('❌ تعذر إسكام العضو، تأكد من صلاحيات البوت وقوة رتبته.');
    }
  }

  // 🔴 أمر تكلم (فك الإسكام)
  if (command === 'تكلم') {
    if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
      return message.reply('❌ ليس لديك صلاحية استخدام هذا الأمر!');
    }
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ يرجى تحديد العضو! مثال: `تكلم @user`');
    try {
      await target.timeout(null);
      message.channel.send(`🔊 تم فك الإسكام عن ${target.user.tag}.`);
    } catch (e) {
      message.reply('❌ تعذر فك الإسكام عن العضو.');
    }
  }

  // 🔴 أمر باند (حظر عضو)
  if (command === 'باند') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('❌ ليس لديك صلاحية استخدام هذا الأمر!');
    }
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ يرجى تحديد العضو! مثال: `باند @user`');
    const reason = args.slice(1).join(' ') || 'بدون سبب';
    try {
      await target.ban({ reason });
      message.channel.send(`🔨 تم حظر ${target.user.tag} بنجاح.`);
    } catch (e) {
      message.reply('❌ تعذر حظر العضو، تأكد أن رتبة البوت أعلى من رتبة العضو.');
    }
  }
});

// تسجيل الدخول بالتوكن من متغيرات البيئة
client.login(process.env.DISCORD_TOKEN);
