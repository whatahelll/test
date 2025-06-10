const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const safeReply = require('../utils/safeReply');

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

        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
        } catch (error) {
            matches = {};
        }

        if (Object.keys(teams).length === 0) {
            return await safeReply(message, 'Nenhum time foi criado ainda!');
        }

        function isTeamInMatch(teamId) {
            return Object.values(matches).some(match => 
                (match.team1 === teamId || match.team2 === teamId) && 
                (match.status === 'aguardando_jogadores' || match.status === 'em_andamento' || match.status === 'votando_vencedor')
            );
        }

        const teamsArray = Object.values(teams);
        const itemsPerPage = 10;
        const totalPages = Math.ceil(teamsArray.length / itemsPerPage);
        let currentPage = 0;

        const generateEmbed = async (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageTeams = teamsArray.slice(start, end);

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'Times Free Fire',
                    iconURL: message.guild.iconURL()
                })
                .setDescription('Lista de todos os times disponíveis:')
                .setColor('#FF6B35')
                .setFooter({ 
                    text: `Página ${page + 1} de ${totalPages} | Use ,desafiar @NomeDoTime para desafiar um time!`
                });

            let description = '';

            for (const team of pageTeams) {
                try {
                    const role = message.guild.roles.cache.get(team.roleId);
                    if (role && role.iconURL()) {
                        team.icon = role.iconURL();
                        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));
                    }

                    let leaderInfo = 'Nenhum líder';
                    
                    if (team.leaders && Array.isArray(team.leaders) && team.leaders.length > 0) {
                        try {
                            const leader = await client.users.fetch(team.leaders[0]);
                            leaderInfo = leader.username;
                            
                            if (team.leaders.length > 1) {
                                leaderInfo += ` +${team.leaders.length - 1}`;
                            }
                        } catch (error) {
                            leaderInfo = 'Erro ao carregar';
                        }
                    } else if (team.leader) {
                        try {
                            const leader = await client.users.fetch(team.leader);
                            leaderInfo = leader.username;
                        } catch (error) {
                            leaderInfo = 'Erro ao carregar';
                        }
                    }

                    const teamInMatch = isTeamInMatch(team.id);
                    const statusEmoji = teamInMatch ? '⚔️' : '⚡';
                    const statusText = teamInMatch ? ' **[EM PARTIDA]**' : '';
                    
                    description += `${statusEmoji} ${team.icon || ''} **${team.name}**${statusText}\n`;
                    description += `👑 Líder: ${leaderInfo}\n`;
                    description += `👥 Membros: ${team.members?.length || 0}\n`;
                    description += `📊 V: ${team.stats?.victories || 0} | D: ${team.stats?.defeats || 0}\n`;
                    
                    if (role) {
                        description += `🏷️ Role: ${role}\n`;
                    }
                    
                    description += '\n';

                } catch (error) {
                    console.log(`Erro ao buscar informações do time ${team.name}:`, error);
                    
                    description += `⚡ ${team.icon || ''} **${team.name}**\n`;
                    description += `👑 Líder: Erro ao carregar\n`;
                    description += `👥 Membros: ${team.members?.length || 0}\n`;
                    description += `📊 V: ${team.stats?.victories || 0} | D: ${team.stats?.defeats || 0}\n\n`;
                }
            }

            embed.setDescription(description);
            return embed;
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`times_first_${message.author.id}`)
                        .setLabel('⏮️ Primeira')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`times_prev_${message.author.id}`)
                        .setLabel('◀️ Anterior')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`times_next_${message.author.id}`)
                        .setLabel('Próxima ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId(`times_last_${message.author.id}`)
                        .setLabel('Última ⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1)
                );
            return totalPages > 1 ? [row] : [];
        };

        const initialEmbed = await generateEmbed(currentPage);
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

                const newEmbed = await generateEmbed(currentPage);
                const newButtons = generateButtons(currentPage);

                await interaction.update({ 
                    embeds: [newEmbed], 
                    components: newButtons 
                });
            });

            collector.on('end', async () => {
                try {
                    const finalEmbed = await generateEmbed(currentPage);
                    const disabledButtons = generateButtons(currentPage).map(row => 
                        new ActionRowBuilder().addComponents(
                            ...row.components.map(button => 
                                ButtonBuilder.from(button).setDisabled(true)
                            )
                        )
                    );
                    
                    await sentMessage.edit({ 
                        embeds: [finalEmbed], 
                        components: disabledButtons 
                    });
                } catch (error) {
                    console.log('Erro ao desabilitar botões:', error.message);
                }
            });
        }
    }
};