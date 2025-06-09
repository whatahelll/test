const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'times',
    description: 'Lista todos os times disponíveis',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        if (Object.keys(teams).length === 0) {
            return message.reply('Nenhum time foi criado ainda!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🔥 Times Free Fire 🔥')
            .setColor('#FF6B35');

        let description = '';
        const buttons = [];

        for (const team of Object.values(teams)) {
            const leader = await client.users.fetch(team.leader);
            description += `${team.icon} **${team.name}**\n`;
            description += `Líder: ${leader.username}\n`;
            description += `Membros: ${team.members.length}\n`;
            description += `V: ${team.stats.victories} | D: ${team.stats.defeats}\n\n`;

            if (message.author.id !== team.leader && buttons.length < 5) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`desafiar_${team.id}`)
                        .setLabel(`Desafiar ${team.name}`)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⚔️')
                );
            }
        }

        embed.setDescription(description);

        const components = [];
        if (buttons.length > 0) {
            components.push(new ActionRowBuilder().addComponents(buttons));
        }

        message.reply({ embeds: [embed], components });
    }
};