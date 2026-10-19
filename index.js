const { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  AuditLogEvent,
  ChannelType,
  Collection
} = require('discord.js');
const express = require('express');

// --- 1. خادم Express مصغر لتشغيل البوت 24/7 على Render ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Y7 Protection Master Core is Active 24/7!'));
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

// 🎨 الألوان والتصميم الفخم (أزرق ملكي وأسود)
const COLOR_BLUE = 0x0f52ba;   // Royal Blue
const COLOR_BLACK = 0x111111;  // Deep Black
const COLOR_CYAN = 0x1e90ff;   // Dodger Blue
const EMBED_FOOTER = 'Y7 Protection • Security Master System';
const BOT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

const spamTracker = new Map();
const actionTracker = new Map();
const raidTracker = new Map();
const guildInvites = new Collection();

const LIMIT_TIME = 10000;
const MAX_DELETIONS = 2;

function isRateLimited(userId, actionType) {
  const key = `${userId}_${actionType}`;
  const now = Date.now();
  const userActions = actionTracker.get(key) || [];
  const recentActions = userActions.filter(timestamp => now - timestamp < LIMIT_TIME);
  recentActions.push(now);
  actionTracker.set(key, recentActions);
  return recentActions.length > MAX_DELETIONS;
}

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

async function notifyOwner(guild, title, description) {
  try {
    const owner = await guild.fetchOwner();
    const embed = createRoyalEmbed(`🚨 ${title}`, description, COLOR_BLACK, '⚠️');
    await owner.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {}
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

function parseDuration(str) {
  if (!str) return 10 * 60 * 1000;
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 10 * 60 * 1000;
  const num = parseInt(match[1]);
  const unit = match[2];
  if (unit === 's') return num * 1000;
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h') return num * 60 * 60 * 1000;
  if (unit === 'd') return num * 24 * 60 * 60 * 1000;
  return 10 * 60 * 1000;
}

// دالة ذكية للبحث عن العضو (بالمنشن أو الـ ID أو النص)
async function findTargetMember(message, args) {
  // 1. البحث بالمنشن
  let target = message.mentions.members.first();
  if (target) return target;

  // 2. البحث بالـ ID المباشر
  if (args[1] && /^\d+$/.test(args[1])) {
    try {
      target = await message.guild.members.fetch(args[1]);
      if (target) return target;
    } catch (e) {}
  }
  return null;
}

client.once('ready', async () => {
  console.log(`[Y7 PROTECTION CORE] Logged in as ${client.user.tag}`);
  client.guilds.cache.forEach(async (guild) => {
    await ensureMutedRole(guild);
    try {
      const invites = await guild.invites.fetch();
      guildInvites.set(guild.id, invites);
    } catch (e) {}
  });
});

client.on('guildCreate', async (guild) => {
  await ensureMutedRole(guild);
  try {
    const invites = await guild.invites.fetch();
    guildInvites.set(guild.id, invites);
  } catch (e) {}
});

client.on('inviteCreate', async (invite) => {
  try {
    const invites = await invite.guild.invites.fetch();
    guildInvites.set(invite.guild.id, invites);
  } catch (e) {}
});

// الأحداث والأنظمة التلقائية
client.on('guildMemberAdd', async (member) => {
  const { guild } = member;
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

client.on('channelDelete', async (channel) => {
  const guild = channel.guild;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
    const entry = logs.entries.first();
    if (entry && entry.executor && !entry.executor.bot) {
      if (isRateLimited(entry.executor.id, 'channel_delete')) {
        const executor = await guild.members.fetch(entry.executor.id);
        await executor.ban({ reason: '[Y7 Anti-Nuke] تخطي حد حذف القنوات' });
        const embed = createRoyalEmbed('💥 Anti-Nuke Protection', `> **المخرب:** ${entry.executor.tag}\n> **القناة:** ${channel.name}`, COLOR_BLACK, '💀');
        await sendDedicatedLog(guild, '🛡️-security-logs', embed);
      }
    }
  } catch (e) {}
});

client.on('roleDelete', async (role) => {
  const guild = role.guild;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
    const entry = logs.entries.first();
    if (entry && entry.executor && !entry.executor.bot) {
      if (isRateLimited(entry.executor.id, 'role_delete')) {
        const executor = await guild.members.fetch(entry.executor.id);
        await executor.ban({ reason: '[Y7 Anti-Nuke] تخطي حد حذف الرتب' });
        const embed = createRoyalEmbed('💥 Role Guard Anti-Nuke', `> **المخرب:** ${entry.executor.tag}\n> **الرتبة:** ${role.name}`, COLOR_BLACK, '💀');
        await sendDedicatedLog(guild, '🛡️-security-logs', embed);
      }
    }
  } catch (e) {}
});

client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const embed = createRoyalEmbed('🗑️ Message Deleted', `> **الكاتب:** ${message.author.tag} (<@${message.author.id}>)\n> **القناة:** <#${message.channel.id}>\n\n\`\`\`${message.content || 'محتوى ميديا'}\`\`\``, COLOR_BLACK, '🗑️');
  await sendDedicatedLog(message.guild, '💬-message-logs', embed);
});

// --- الأوامر المباشرة المحسنة ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const { guild, channel, author, member, content } = message;

  // Anti-Link
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  if (linkRegex.test(content) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.delete().catch(() => {});
    const warning = await channel.send({ embeds: [createRoyalEmbed('⚠️ تنبيه أمني', `<@${author.id}> يمنع إرسال الروابط والتصيد!`, COLOR_BLACK, '🛑')] });
    setTimeout(() => warning.delete().catch(() => {}), 5000);
    return;
  }

  const args = content.trim().split(/ +/);
  const command = args[0]?.toLowerCase();

  // 1️⃣ أمر: اص @العضو أو الـ ID
  if (command === 'اص') {
    if (!member.permissions.has(PermissionFlagsBits.MuteMembers)) return;
    const target = await findTargetMember(message, args);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو بالمنشن أو الـ ID! مثال: `اص @user`', COLOR_BLACK, '⚠️')] });

    const mutedRole = await ensureMutedRole(guild);
    try {
      await target.roles.add(mutedRole);
      await target.timeout(10 * 60 * 1000, `بواسطة ${author.tag}`);
      await message.reply({ embeds: [createRoyalEmbed('🔇 Mute Executed', `> **تم إسكام:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_BLUE, '🔇')] });
      await sendDedicatedLog(guild, '🔨-mod-logs', createRoyalEmbed('🔇 Mute Log', `> **العضو:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_BLUE, '🔇'));
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'تأكد أن رتبة البوت أعلى من رتبة العضو.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 2️⃣ أمر: تكلم @العضو أو الـ ID
  if (command === 'تكلم') {
    if (!member.permissions.has(PermissionFlagsBits.MuteMembers)) return;
    const target = await findTargetMember(message, args);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو بالمنشن أو الـ ID!', COLOR_BLACK, '⚠️')] });

    const mutedRole = await ensureMutedRole(guild);
    try {
      await target.roles.remove(mutedRole);
      await target.timeout(null);
      await message.reply({ embeds: [createRoyalEmbed('🔊 Unmute Executed', `> **تم فك الإسكام عن:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '🔊')] });
      await sendDedicatedLog(guild, '🔨-mod-logs', createRoyalEmbed('🔊 Unmute Log', `> **العضو:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '🔊'));
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'تعذر فك الإسكام.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 3️⃣ أمر: باند @العضو أو الـ ID
  if (command === 'باند') {
    if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return;
    const target = await findTargetMember(message, args);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو بالمنشن أو الـ ID! مثال: `باند @user`', COLOR_BLACK, '⚠️')] });

    const reason = args.slice(2).join(' ') || 'بدون سبب';
    try {
      await target.ban({ reason: `${reason} | بواسطة ${author.tag}` });
      await message.reply({ embeds: [createRoyalEmbed('🔨 Ban Executed', `> **تم حظر:** ${target.user.tag}\n> **السبب:** ${reason}\n> **بواسطة:** ${author.tag}`, COLOR_BLACK, '🔨')] });
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'رتبة العضو أعلى من رتبة البوت.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 4️⃣ أمر: فك الباند USER_ID
  if (command === 'فك' && args[1] === 'الباند') {
    if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return;
    const userId = args[2];
    if (!userId || !/^\d+$/.test(userId)) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى كتابة الـ ID الصحيح! مثال: `فك الباند 123456789`', COLOR_BLACK, '⚠️')] });

    try {
      await guild.members.unban(userId);
      await message.reply({ embeds: [createRoyalEmbed('🔓 Unban Executed', `> **تم فك الحظر عن:** \`${userId}\`\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '🔓')] });
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'هذا الـ ID غير محظور أو غير صحيح.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 5️⃣ أمر: تايم @العضو 10m أو بالـ ID
  if (command === 'تايم') {
    if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
    const target = await findTargetMember(message, args);
    const timeArg = args[2] || '10m';
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو والوقت! مثال: `تايم @user 10m`', COLOR_BLACK, '⚠️')] });

    const duration = parseDuration(timeArg);
    try {
      await target.timeout(duration, `بواسطة ${author.tag}`);
      await message.reply({ embeds: [createRoyalEmbed('⏱️ Timeout Applied', `> **العضو:** ${target.user.tag}\n> **المدة:** ${timeArg}\n> **بواسطة:** ${author.tag}`, COLOR_BLUE, '⏱️')] });
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'تعذر إعطاء تايم أوت.', COLOR_BLACK, '⚠️')] });
    }
  }

  // 6️⃣ أمر: فك التايم @العضو أو بالـ ID
  if (command === 'فك' && args[1] === 'التايم') {
    if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
    const target = await findTargetMember(message, args);
    if (!target) return message.reply({ embeds: [createRoyalEmbed('❌ خطأ', 'يرجى تحديد العضو! مثال: `فك التايم @user`', COLOR_BLACK, '⚠️')] });

    try {
      await target.timeout(null);
      await message.reply({ embeds: [createRoyalEmbed('⏳ Timeout Removed', `> **تم فك التايم عن:** ${target.user.tag}\n> **بواسطة:** ${author.tag}`, COLOR_CYAN, '⏳')] });
    } catch (e) {
      message.reply({ embeds: [createRoyalEmbed('❌ تعذر التنفيذ', 'تعذر فك التايم.', COLOR_BLACK, '⚠️')] });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
