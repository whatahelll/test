const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'convidar',
    description: 'Convida um membro para seu time',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        let invites = {};
        try {
            invites = JSON.parse(fs.readFileSync('./dados/convites.json', 'utf8'));
        } catch (error) {
            invites = {};
        }

        const team = Object.values(teams).find(t => {
            if (t.leaders && Array.isArray(t.leaders)) {
                return t.leaders.includes(message.author.id);
            }
            if (t.leader) {
                return t.leader === message.author.id;
            }
            return false;
        });

        if (!team) {
            return await safeReply(message, 'Você não é líder de nenhum time!');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return await safeReply(message, 'Mencione um membro para convidar!');
        }

        if (!team.members || !Array.isArray(team.members)) {
            team.members = [];
        }

        if (team.members.includes(member.id)) {
            return await safeReply(message, 'Este membro já está no seu time!');
        }

        const memberInOtherTeam = Object.values(teams).some(t => {
            if (!t.members || !Array.isArray(t.members)) return false;
            return t.members.includes(member.id);
        });

        if (memberInOtherTeam) {
            return await safeReply(message, 'Este membro já está em outro time!');
        }

        const existingInvite = Object.values(invites).find(inv => 
            inv.teamId === team.id && inv.userId === member.id && inv.status === 'pendente'
        );

        if (existingInvite) {
            return await safeReply(message, 'Este membro já possui um convite pendente do seu time!');
        }

        const inviteId = `invite_${Date.now()}_${member.id}`;
        invites[inviteId] = {
            id: inviteId,
            teamId: team.id,
            userId: member.id,
            invitedBy: message.author.id,
            status: 'pendente',
            createdAt: new Date().toISOString()
        };

        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: 'Convite para Time',
                iconURL: member.user.avatarURL()
            })
            .setDescription(`${member}, você foi convidado para o time **${team.name}** ${team.icon || ''}!\n\nConvidado por: ${message.author}`)
            .setColor(team.color)
            .setThumbnail(message.guild.iconURL())
            .addFields(
                { name: 'Time', value: `${team.icon || ''} ${team.name}`, inline: true },
                { name: 'Membros', value: `${team.members.length}`, inline: true },
                { name: 'Vitórias', value: `${team.stats?.victories || 0}`, inline: true }
            )
            .setFooter({ 
                text: 'Aceite ou recuse o convite usando os botões abaixo'
            });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`aceitar_convite_${inviteId}`)
                    .setLabel('Aceitar')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`recusar_convite_${inviteId}`)
                    .setLabel('Recusar')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

        try {
            if (!fs.existsSync('./dados')) fs.mkdirSync('./dados');
            fs.writeFileSync('./dados/convites.json', JSON.stringify(invites, null, 2));
            console.log('Convite salvo:', inviteId, invites[inviteId]);
            
            await safeReply(message, { embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Erro ao salvar convite:', error);
            await safeReply(message, 'Erro ao enviar convite!');
        }
    }
};