const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'ranking',
    description: 'Mostra o ranking dos times',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        if (Object.keys(teams).length === 0) {
            return await safeReply(message, 'Nenhum time foi criado ainda!');
        }

        for (const team of Object.values(teams)) {
            const role = message.guild.roles.cache.get(team.roleId);
            if (role && role.iconURL()) {
                team.icon = role.iconURL();
            }
        }

        const sortedTeams = Object.values(teams).sort((a, b) => {
            const winRateA = a.stats.matches > 0 ? a.stats.victories / a.stats.matches : 0;
            const winRateB = b.stats.matches > 0 ? b.stats.victories / b.stats.matches : 0;
            return winRateB - winRateA || b.stats.victories - a.stats.victories;
        });

        const itemsPerPage = 10;
        const totalPages = Math.ceil(sortedTeams.length / itemsPerPage);
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageTeams = sortedTeams.slice(start, end);

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'Ranking dos Times',
                    iconURL: message.guild.iconURL()
                })
                .setColor('#FFD700')
                .setFooter({ 
                    text: `Página ${page + 1} de ${totalPages} | Total de ${sortedTeams.length} times registrados`
                });

            let description = '';
            pageTeams.forEach((team, index) => {
                const position = start + index;
                const winRate = team.stats.matches > 0 ? ((team.stats.victories / team.stats.matches) * 100).toFixed(1) : 0;
                const medal = position === 0 ? '🥇' : position === 1 ? '🥈' : position === 2 ? '🥉' : `${position + 1}º`;
                
                description += `${medal} ${team.icon || ''} **${team.name}**\n`;
                description += `Vitórias: ${team.stats.victories} | Derrotas: ${team.stats.defeats}\n`;
                description += `Taxa de vitória: ${winRate}% | Partidas: ${team.stats.matches}\n\n`;
            });

            embed.setDescription(description);
            return embed;
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ranking_first_${message.author.id}`)
                        .setLabel('⏮️ Primeira')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`ranking_prev_${message.author.id}`)
                        .setLabel('◀️ Anterior')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`ranking_next_${message.author.id}`)
                        .setLabel('Próxima ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId(`ranking_last_${message.author.id}`)
                        .setLabel('Última ⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1)
                );
            return totalPages > 1 ? [row] : [];
        };

        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        const initialEmbed = generateEmbed(currentPage);
        const initialButtons = generateButtons(currentPage);

        const sentMessage = await safeReply(message, { 
            embeds: [initialEmbed], 
            components: initialButtons 
        });

        if (totalPages > 1 && sentMessage) {
            const collector = sentMessage.createMessageComponentCollector({ 
                time: 60000 
            });

            collector.on('collect', async (interaction) => {
                if (!interaction.customId.endsWith(message.author.id)) {
                    return await interaction.reply({ 
                        content: 'Apenas quem solicitou pode navegar pelas páginas!', 
                        ephemeral: true 
                    });
                }

                const action = interaction.customId.split('_')[1];
                
                switch(action) {
                    case 'first':
                        currentPage = 0;
                        break;
                    case 'prev':
                        if (currentPage > 0) currentPage--;
                        break;
                    case 'next':
                        if (currentPage < totalPages - 1) currentPage++;
                        break;
                    case 'last':
                        currentPage = totalPages - 1;
                        break;
                }

                const newEmbed = generateEmbed(currentPage);
                const newButtons = generateButtons(currentPage);

                await interaction.update({ 
                    embeds: [newEmbed], 
                    components: newButtons 
                });
            });

            collector.on('end', async () => {
                try {
                    const disabledButtons = generateButtons(currentPage).map(row => 
                        new ActionRowBuilder().addComponents(
                            ...row.components.map(button => 
                                ButtonBuilder.from(button).setDisabled(true)
                            )
                        )
                    );
                    
                    await sentMessage.edit({ 
                        embeds: [generateEmbed(currentPage)], 
                        components: disabledButtons 
                    });
                } catch (error) {
                    console.log('Erro ao desabilitar botões:', error.message);
                }
            });
        }
    }
};