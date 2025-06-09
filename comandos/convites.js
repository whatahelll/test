const { EmbedBuilder } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'convites',
    description: 'Mostra os convites pendentes do seu time',
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

        const team = Object.values(teams).find(t => t.leaders.includes(message.author.id));
        if (!team) {
            return await safeReply(message, 'Você não é líder de nenhum time!');
        }

        const pendingInvites = Object.values(invites).filter(inv => 
            inv.teamId === team.id && inv.status === 'pendente'
        );

        if (pendingInvites.length === 0) {
            return await safeReply(message, 'Seu time não possui convites pendentes.');
        }

        const embed = new EmbedBuilder()
            .setTitle(`📩 Convites Pendentes - ${team.name}`)
            .setColor(team.color);

        let description = '';
        for (const invite of pendingInvites) {
            try {
                const user = await client.users.fetch(invite.userId);
                const inviter = await client.users.fetch(invite.invitedBy);
                const createdDate = new Date(invite.createdAt).toLocaleDateString('pt-BR');
                
                description += `👤 **${user.username}**\n`;
                description += `Convidado por: ${inviter.username}\n`;
                description += `Data: ${createdDate}\n\n`;
            } catch (error) {
                console.log(`Erro ao buscar usuário do convite ${invite.id}`);
            }
        }

        embed.setDescription(description);
        await safeReply(message, { embeds: [embed] });
    }
};