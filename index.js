const { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ChannelType,
  Collection,
  AuditLogEvent
} = require('discord.js');
const express = require('express');

// --- 1. خادم Express مصغر لتشغيل البوت 24/7 على Render ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Y7 Ultimate Protection Core is Active 24/7!'));
app.listen(PORT, () => console.log(`[HTTP Server] Running smoothly on port ${PORT}`));

// --- 2. إعداد البوت والصلاحيات الشاملة ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildPresences,
  ],
});

// 🎨 الألوان والتصميم الملكي الفخم (أزرق ملكي وأسود)
const COLOR_BLUE = 0x0f52ba;   // Royal Blue
const COLOR_BLACK = 0x111111;  // Deep Black
const COLOR_CYAN = 0x1e90ff;   // Dodger Blue
const EMBED_FOOTER = 'Y7 Protection • Ultimate Security System';
const BOT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

const guildInvites = new Collection();
const spamTracker = new Map();

// متتبعات حماية الإداريين الشاملة (Anti-Nuke Trackers)
const adminChannelDeleteTracker = new Map();
const adminChannelCreateTracker = new Map();
const adminRoleDeleteTracker = new Map();
const adminRoleCreateTracker = new Map();
const adminBanTracker = new Map();

function createRoyalEmbed(title, description, color = COLOR_BLUE, icon = '🛡️') {
  return new EmbedBuilder()
    .setAuthor({ name: `Y7 PROTECTION SYSTEM | ${icon}`, iconURL: client.user?.displayAvatarURL() || BOT_AVATAR })
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: EMBED_FOOTER })
    .setTimestamp();
}

async function sendDedicatedLog(guild, channelName, embed) {
  try {
    let category = guild.channels.cache.find(c => c.name === '🛡️-y7-logs' && c.type === ChannelType.GuildCategory);
    if (!category) {
      category = await guild.channels.create({
        name: '🛡️-y7-logs',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
      });
    }

    let logChannel = guild.channels.cache.find(c => c.name === channelName && c.parentId === category.id);
    if (!logChannel) {
      logChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
      });
    }

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[Log Error - ${channelName}]`, err);
  }
}

// دالة حرمان وتجريد الإداري المخالف من كل الصلاحيات فوراً
async function punishAdmin(guild, executorId, reason) {
  try {
    if (executorId === guild.ownerId) return; // استثناء مالك السيرفر الأصلي
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;

    const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.id && r.editable);
    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove, `[Admin Guard Violation] ${reason}`);
    }

    const warnEmbed = createRoyalEmbed(
      '🚨 ADMIN GUARD VIOLATION DETECTED',
      `> **تم تجريد الإداري المخالف من جميع رتباته!**\n\n👤 **الإداري:** <@${member.id}> (${member.user.tag})\n🆔 **المعرف:** \`${member.id}\`\n⚠️ **السبب:** ${reason}\n🛡️ **الإجراء:** سحب فوري لكافة الرتب والصلاحيات لمنع التخريب.`,
      COLOR_BLACK,
      '🚨'
    );

    await sendDedicatedLog(guild, '🛡️-security-logs', warnEmbed);
  } catch (err) {
    console.error('[Punish Admin Error]', err);
  }
}

async function sendWelcomeMessage(member, inviter) {
  try {
    const { guild } = member;
    let welcomeChannel = guild.channels.cache.find(c => c.name === '👋-y7-welcome');
    
    if (!welcomeChannel) {
      welcomeChannel = await guild.channels.create({
        name: '👋-y7-welcome',
        type: ChannelType.GuildText,
        reason: 'روم الترحيب التلقائي لبوت Y7',
      });
    }

    const memberCount = guild.memberCount;
    const userAvatar = member.user.displayAvatarURL({ dynamic: true, size: 256 });
    const inviterText = inviter ? `<@${inviter.id}> (${inviter.tag})` : '`غير معروف / رابط مباشر`';

    const welcomeEmbed = new EmbedBuilder()
      .setAuthor({ name: `Y7 PROTECTION SYSTEM | 👑`, iconURL: client.user?.displayAvatarURL() || BOT_AVATAR })
      .setTitle(`👋 أهلاً بك في ${guild.name}`)
      .setDescription(`> **نورت السيرفر يا غالي! نتمنى لك وقتاً ممتعاً معنا.**\n\n👤 **العضو:** <@${member.id}>\n🆔 **المعرف:** \`${member.id}\`\n📩 **دخل من قبل:** ${inviterText}\n📊 **أنت العضو رقم:** \`Member #${memberCount}\`\n📅 **تاريخ إنشاء الحساب:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
      .setThumbnail(userAvatar)
      .setColor(COLOR_BLUE)
      .setFooter({ text: EMBED_FOOTER })
      .setTimestamp();

    await welcomeChannel.send({ content: `👋 أهلاً بك <@${member.id}> في السيرفر!`, embeds: [welcomeEmbed] });
  } catch (err) {
    console.error('[Welcome Error]', err);
  }
}

async function ensureMutedRole(guild) {
  try {
    let mutedRole = guild.roles.cache.find(r => r.name === 'Muted');
    if (!mutedRole) {
      mutedRole = await guild.roles.create({
        name: 'Muted',
        color: 0x111111,
        reason: 'Y7 Auto Muted Role Setup',
      });

      guild.channels.cache.forEach(async (channel) => {
        try {
          await channel.permissionOverwrites.create(mutedRole, {
            SendMessages: false,
            AddReactions: false,
            Speak: false,
          });
        } catch (e) {}
      });
    }
    return mutedRole;
  } catch (err) {
    console.error('[Muted Role Error]', err);
  }
}

async function findTargetMember(message, queryArg) {
  let target = message.mentions.members.first();
  if (target) return target;

  if (queryArg && /^\d+$/.test(queryArg)) {
    try {
      target = await message.guild.members.fetch(queryArg);
      if (target) return target;
    } catch (e) {}
  }
  return null;
}

client.once('ready', async () => {
  console.log(`[Y7 PROTECTION ULTIMATE] Logged in as ${client.user.tag}`);
  client.guilds.cache.forEach(async (guild) => {
    await ensureMutedRole(guild);
    try {
      const invites = await guild.invites.fetch();
      guildInvites.set(guild.id, invites);
    } catch (e) {}
  });
});

// --- 🛑 حمايات الإداريين (Anti-Nuke Guards) ---

// 1. مراقبة حذف القنوات
client.on('channelDelete', async (channel) => {
  if (!channel.guild) return;
  try {
    const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
    if (!auditLogs) return;
    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor || entry.executor.bot) return;

    const executorId = entry.executor.id;
    const now = Date.now();
    const userDeletes = adminChannelDeleteTracker.get(executorId) || [];
    const recentDeletes = userDeletes.filter(ts => now - ts < 10000);
    recentDeletes.push(now);
    adminChannelDeleteTracker.set(executorId, recentDeletes);

    if (recentDeletes.length > 2) {
      await punishAdmin(channel.guild, executorId, 'حذف مكثف للقنوات (أكثر من قناتين في 10 ثوانٍ)');
      adminChannelDeleteTracker.delete(executorId);
    }
  } catch (err) {}
});

// 2. مراقبة إنشاء القنوات الجماعي
client.on('channelCreate', async (channel) => {
  if (!channel.guild) return;
  try {
    const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate }).catch(() => null);
    if (!auditLogs) return;
    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor || entry.executor.bot) return;

    const executorId = entry.executor.id;
    const now = Date.now();
    const userCreates = adminChannelCreateTracker.get(executorId) || [];
    const recentCreates = userCreates.filter(ts => now - ts < 10000);
    recentCreates.push(now);
    adminChannelCreateTracker.set(executorId, recentCreates);

    if (recentCreates.length > 3) {
      await punishAdmin(channel.guild, executorId, 'إنشاء عشوائي للقنوات (أكثر من 3 قنوات في 10 ثوانٍ)');
      adminChannelCreateTracker.delete(executorId);
    }
  } catch (err) {}
});

// 3. مراقبة حذف الرتب
client.on('roleDelete', async (role) => {
  try {
    const auditLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
    if (!auditLogs) return;
    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor || entry.executor.bot) return;

    const executorId = entry.executor.id;
    const now = Date.now();
    const userDeletes = adminRoleDeleteTracker.get(executorId) || [];
    const recentDeletes = userDeletes.filter(ts => now - ts < 10000);
    recentDeletes.push(now);
    adminRoleDeleteTracker.set(executorId, recentDeletes);

    if (recentDeletes.length > 2) {
      await punishAdmin(role.guild, executorId, 'حذف جماعي للرتب (أكثر من رتبتين في 10 ثوانٍ)');
      adminRoleDeleteTracker.delete(executorId);
    }
  } catch (err) {}
});

// 4. مراقبة الباند الجماعي
client.on('guildBanAdd', async (ban) => {
  const { guild } = ban;
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
    if (!auditLogs) return;
    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor || entry.executor.bot) return;

    const executorId = entry.executor.id;
    const now = Date.now();
    const userBans = adminBanTracker.get(executorId) || [];
    const recentBans = userBans.filter(ts => now - ts < 10000);
    recentBans.push(now);
    adminBanTracker.set(executorId, recentBans);

    if (recentBans.length > 2) {
      await punishAdmin(guild, executorId, 'حظر جماعي للأعضاء (أكثر من عضوين في 10 ثوانٍ)');
      adminBanTracker.delete(executorId);
    }
  } catch (err) {}
});

// 5. حماية الويب هوك (Anti-Webhook)
client.on('webhookUpdate', async (channel) => {
  try {
    const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate }).catch(() => null);
    if (!auditLogs) return;
    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor || entry.executor.bot) return;

    await punishAdmin(channel.guild, entry.executor.id, 'حظر إنشاء الويب هوك التخريبية (Anti-Webhook Guard)');
  } catch (err) {}
});

// --- الأحداث العامة ---
client.on('guildMemberAdd', async (member) => {
  const { guild } = member;

  // Anti-Bot Guard
  if (member.user.bot) {
    try {
      await member.ban({ reason: '[Y7 Protection] دخول بوتات غير مصرح بها' });
      const embed = createRoyalEmbed('🛡️ Anti-Bot Guard', `> **تم حظر البوت:** ${member.user.tag}\n> **المعرف:** \`${member.id}\``, COLOR_BLACK, '🤖');
      await sendDedicatedLog(guild, '🤖-bot-logs', embed);
      return;
    } catch (e) {}
  }

  let inviter = null;
  try {
    const newInvites = await guild.invites.fetch();
    const oldInvites = guildInvites.get(guild.id);
    if (oldInvites) {
      const usedInvite = newInvites.find(inv => inv.uses > (oldInvites.get(inv.code)?.uses || 0));
      if (usedInvite) inviter = usedInvite.inviter;
    }
    guildInvites.set(guild.id, newInvites);
  } catch (e) {}

  await sendWelcomeMessage(member, inviter);

  const inviterLog = inviter ? `<@${inviter.id}>` : 'غير معروف';
  const joinEmbed = createRoyalEmbed('📥 انضمام عضو جديد', `> **العضو:** ${member.user.tag} (<@${member.id}>)\n> **دعوة بواسطة:** ${inviterLog}\n> **الحساب:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, COLOR_CYAN, '👑');
  await sendDedicatedLog(guild, '🚪-join-leave-logs', joinEmbed);
});

client.on('guildMemberRemove', async (member) => {
  const leaveEmbed = createRoyalEmbed('📤 مغادرة عضو', `> **العضو:** ${member.user.tag} (<@${member.id}>)`, COLOR_BLACK, '🚪');
  await sendDedicatedLog(member.guild, '🚪-join-leave-logs', leaveEmbed);
});

client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const embed = createRoyalEmbed('🗑️ Message Deleted', `> **الكاتب:** ${message.author.tag} (<@${message.author.id}>)\n> **القناة:** <#${message.channel.id}>\n\n\`\`\`${message.content || 'محتوى ميديا'}\`\`\``, COLOR_BLACK, '🗑️');
  await sendDedicatedLog(message.guild, '💬-message-logs', embed);
});

// --- الأوامر والحماية المباشرة ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const { guild, channel, author, member, content } = message;

  // 1️⃣ Anti-Link
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  if (linkRegex.test(content) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.delete().catch(() => {});
    const warning = await channel.send({ embeds: [createRoyalEmbed('⚠️ تنبيه أمني', `<@${author.id}> يمنع إرسال الروابط والتصيد!`, COLOR_BLACK, '🛑')] });
    setTimeout(() => warning.delete().catch(() => {}), 5000);
    return;
  }

  // 2️⃣ Anti-Spam (3 رسائل بـ ثانيتين = تايم أوت 5 دقائق)
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    const now = Date.now();
    const userTimestamps = spamTracker.get(author.id) || [];
    
    const recentMessages = userTimestamps.filter(timestamp => now - timestamp < 2000);
    recentMessages.push(now);
    spamTracker.set(author.id, recentMessages);

    if (recentMessages.length >= 3) {
      try {
        await member.timeout(5 * 60 * 1000, '[Y7 Anti-Spam] إرسال 3 رسائل أو أكثر في أقل من ثانيتين');
        spamTracker.delete(author.id);

        await message.delete().catch(() => {});
        const warnSpam = await channel.send({ embeds: [createRoyalEmbed('⚡ Anti-Spam Violation', `<@${author.id}> تم إعطاؤك تايم أوت لمدة **5 دقائق** بسبب السبام والإغراق!`, COLOR_BLACK, '⚡')] });
        setTimeout(() => warnSpam.delete().catch(() => {}), 6000);

        const spamEmbed = createRoyalEmbed('⚡ Anti-Spam Auto-Mod Log', `> **العضو المخالف:** ${author.tag} (<@${author.id}>)\n> **السبب:** إرسال 3 رسائل أو أكثر خلال ثانيتين.\n> **الإجراء:** تايم أوت آلي لمدة \`5 دقائق\`.`, COLOR_BLUE, '🛡️');
        await sendDedicatedLog(guild, '🛡️-security-logs', spamEmbed);
        return;
      } catch (e) {}
    }
  }

  const args = content.trim().split(/ +/);
  const command = args[0]?.toLowerCase();

  // 🧹 أمر المسح
  if (command === 'مسح' || command === 'clear') {
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
    const count = parseInt(args[1]) || 10;
    const fetchLimit = Math.min(count, 100);

    try {
      await message.delete().catch(() => {});
      const messages = await channel.messages.fetch({ limit: fetchLimit });
      await channel.bulkDelete(messages, true);

      const replyMsg = await channel.send({ embeds: [createRoyalEmbed('🧹 Message Purge', `> **تم مسح:** \`${messages.size}\` رسالة بنجاح.\n> **بواسطة:** ${author.tag}`, COLOR_BLUE, '🧹')] });
      setTimeout(() => replyMsg.delete().catch(() => {}), 4000);
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ خطأ في المسح', 'تعذر مسح الرسائل (أقدم من 14 يوماً).', COLOR_BLACK, '⚠️')] });
    }
  }

  // 🔇 أمر الميوت
  if (command === 'اص') {
    if (!member.permissions.has(PermissionFlagsBits.MuteMembers)) return;
    const target = await findTargetMember(message, args[1]);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو بالمنشن أو الـ ID! مثال: `اص @user`', COLOR_BLACK, '⚠️')] });

    const mutedRole = await ensureMutedRole(guild);
    try {
      await target.roles.add(mutedRole);
      await message.reply({ embeds: [createRoyalEmbed('🔇 Mute Executed', `> **تم إسكام العضو بنجاح:** ${target.user.tag}\n> **الرتبة المضافة:** \`Muted\` (منع كامل من الكتابة)\n> **بواسطة:** ${author.tag}`, COLOR_BLUE, '🔇')] });
      await sendDedicatedLog(guild, '🔨-mod-logs', createRoyalEmbed('🔇 Mute Log', `> **العضو:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_BLUE, '🔇'));
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'رتبة البوت أدنى من رتبة العضو المستهدف.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 🔊 أمر فك الميوت
  if (command === 'تكلم') {
    if (!member.permissions.has(PermissionFlagsBits.MuteMembers)) return;
    const target = await findTargetMember(message, args[1]);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو بالمنشن أو الـ ID!', COLOR_BLACK, '⚠️')] });

    const mutedRole = await ensureMutedRole(guild);
    try {
      await target.roles.remove(mutedRole);
      await message.reply({ embeds: [createRoyalEmbed('🔊 Unmute Executed', `> **تم فك الميوت عن:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '🔊')] });
      await sendDedicatedLog(guild, '🔨-mod-logs', createRoyalEmbed('🔊 Unmute Log', `> **العضو:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '🔊'));
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'تعذر إزالة رتبة الميوت.', COLOR_BLACK, '⚠️')] });
    }
  }

  // ⏱️ قائمة التايم أوت
  if (command === 'تايم') {
    if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
    const target = await findTargetMember(message, args[1]);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو! مثال: `تايم @user`', COLOR_BLACK, '⚠️')] });

    const embed = createRoyalEmbed('⏱️ Y7 Timeout Panel', `> **اختر مدة التايم أوت للعضو:** ${target.user.tag}\n> **التصميم الملكي:** أسود وأزرق`, COLOR_BLACK, '⏱️');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`timeout_${target.id}`)
      .setPlaceholder('اختر مدة التايم أوت...')
      .addOptions([
        { label: '5 دقائق', value: '300000', description: 'إعطاء تايم أوت لمدة 5 دقائق', emoji: '⏳' },
        { label: '10 دقائق', value: '600000', description: 'إعطاء تايم أوت لمدة 10 دقائق', emoji: '⏱️' },
        { label: 'ساعة واحدة', value: '3600000', description: 'إعطاء تايم أوت لمدة ساعة', emoji: '⏰' },
        { label: '24 ساعة (يوم)', value: '86400000', description: 'إعطاء تايم أوت لمدة يوم كامل', emoji: '📅' },
        { label: '7 أيام (أسبوع)', value: '604800000', description: 'إعطاء تايم أوت لمدة أسبوع', emoji: '🛡️' },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await message.reply({ embeds: [embed], components: [row] });
  }

  // ⏳ أمر فك التايم
  if (command === 'فك' && args[1] === 'التايم') {
    if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
    const target = await findTargetMember(message, args[2]);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو بالمنشن أو الـ ID! مثال: `فك التايم @user`', COLOR_BLACK, '⚠️')] });

    try {
      await target.timeout(null);
      await message.reply({ embeds: [createRoyalEmbed('⏳ Timeout Removed', `> **تم فك التايم عن:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '⏳')] });
      await sendDedicatedLog(guild, '🔨-mod-logs', createRoyalEmbed('⏳ Un-Timeout Log', `> **العضو:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '⏳'));
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'تعذر فك التايم.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 🔨 أمر الباند
  if (command === 'باند') {
    if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return;
    const target = await findTargetMember(message, args[1]);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو! مثال: `باند @user`', COLOR_BLACK, '⚠️')] });

    const reason = args.slice(2).join(' ') || 'بدون سبب';
    try {
      await target.ban({ reason: `${reason} | بواسطة ${author.tag}` });
      await message.reply({ embeds: [createRoyalEmbed('🔨 Ban Executed', `> **تم حظر:** ${target.user.tag}\n> **السبب:** ${reason}\n> **بواسطة:** ${author.tag}`, COLOR_BLACK, '🔨')] });
      await sendDedicatedLog(guild, '🔨-mod-logs', createRoyalEmbed('🔨 Ban Log', `> **العضو:** ${target.user.tag}\n> **السبب:** ${reason}\n> **بواسطة:** ${author.tag}`, COLOR_BLACK, '🔨'));
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'رتبة العضو أعلى من رتبة البوت.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 🔓 فك الباند
  if (command === 'فك' && args[1] === 'الباند') {
    if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return;
    const userId = args[2];
    if (!userId || !/^\d+$/.test(userId)) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى كتابة الـ ID الصحيح!', COLOR_BLACK, '⚠️')] });

    try {
      await guild.members.unban(userId);
      await message.reply({ embeds: [createRoyalEmbed('🔓 Unban Executed', `> **تم فك الحظر عن الحساب:** \`${userId}\`\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '🔓')] });
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'هذا الـ ID غير محظور.', COLOR_BLACK, '⚠️')] });
    }
  }
});

// --- استجابة قائمة التايم أوت التفاعلية ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith('timeout_')) return;

  const targetId = interaction.customId.split('_')[1];
  const duration = parseInt(interaction.values[0]);
  const guild = interaction.guild;

  try {
    const target = await guild.members.fetch(targetId);
    await target.timeout(duration, `بواسطة ${interaction.user.tag}`);

    const durationText = interaction.component.options.find(o => o.value === interaction.values[0])?.label || 'محدد';

    await interaction.update({
      embeds: [createRoyalEmbed('⏱️ Timeout Applied Successfully', `> **العضو:** ${target.user.tag}\n> **المدة المختارة:** \`${durationText}\`\n> **بواسطة:** ${interaction.user.tag}`, COLOR_BLUE, '⏱️')],
      components: []
    });

    await sendDedicatedLog(guild, '🔨-mod-logs', createRoyalEmbed('⏱️ Timeout Panel Log', `> **العضو:** ${target.user.tag}\n> **المدة:** ${durationText}\n> **بواسطة:** ${interaction.user.tag}`, COLOR_BLUE, '⏱️'));
  } catch (e) {
    await interaction.update({
      embeds: [createRoyalEmbed('❌ خطأ', 'تعذر إعطاء التايم أوت للعضو.', COLOR_BLACK, '⚠️')],
      components: []
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
