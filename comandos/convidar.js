const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
            return message.reply('Você não é líder de nenhum time!');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('Mencione um membro para convidar!');
        }

        if (!team.members || !Array.isArray(team.members)) {
            team.members = [];
        }

        if (team.members.includes(member.id)) {
            return message.reply('Este membro já está no seu time!');
        }

        const memberInOtherTeam = Object.values(teams).some(t => {
            if (!t.members || !Array.isArray(t.members)) return false;
            return t.members.includes(member.id);
        });

        if (memberInOtherTeam) {
            return message.reply('Este membro já está em outro time!');
        }

        const existingInvite = Object.values(invites).find(inv => 
            inv.teamId === team.id && inv.userId === member.id && inv.status === 'pendente'
        );

        if (existingInvite) {
            return message.reply('Este membro já possui um convite pendente do seu time!');
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
            .setTitle('📩 Convite para Time')
            .setDescription(`${member}, você foi convidado para o time **${team.name}** ${team.icon}!\n\nConvidado por: ${message.author}`)
            .setColor(team.color)
            .setThumbnail(message.guild.iconURL())
            .addFields(
                { name: 'Time', value: `${team.icon} ${team.name}`, inline: true },
                { name: 'Membros', value: `${team.members.length}`, inline: true },
                { name: 'Vitórias', value: `${team.stats?.victories || 0}`, inline: true }
            );

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
            
            await message.reply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Erro ao salvar convite:', error);
            message.reply('Erro ao enviar convite!');
        }
    }
};