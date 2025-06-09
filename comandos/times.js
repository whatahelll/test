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

        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
        } catch (error) {
            matches = {};
        }

        if (Object.keys(teams).length === 0) {
            return message.reply('Nenhum time foi criado ainda!');
        }

        function isTeamInMatch(teamId) {
            return Object.values(matches).some(match => 
                (match.team1 === teamId || match.team2 === teamId) && 
                (match.status === 'aguardando_jogadores' || match.status === 'em_andamento' || match.status === 'votando_vencedor')
            );
        }

        const userTeam = Object.values(teams).find(t => {
            if (t.leaders && Array.isArray(t.leaders)) {
                return t.leaders.includes(message.author.id);
            }
            if (t.leader) {
                return t.leader === message.author.id;
            }
            return false;
        });

        const embed = new EmbedBuilder()
            .setTitle('🔥 Times Free Fire 🔥')
            .setColor('#FF6B35');

        let description = '';
        const buttons = [];

        for (const team of Object.values(teams)) {
            try {
                const role = message.guild.roles.cache.get(team.roleId);
                if (role && role.iconURL()) {
                    team.icon = role.iconURL();
                    fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));
                }

                let leaderInfo = 'Nenhum líder';
                
                if (team.leaders && Array.isArray(team.leaders) && team.leaders.length > 0) {
                    const leader = await client.users.fetch(team.leaders[0]);
                    leaderInfo = leader.username;
                    
                    if (team.leaders.length > 1) {
                        leaderInfo += ` +${team.leaders.length - 1}`;
                    }
                } else if (team.leader) {
                    const leader = await client.users.fetch(team.leader);
                    leaderInfo = leader.username;
                }

                const teamInMatch = isTeamInMatch(team.id);
                const statusEmoji = teamInMatch ? '⚔️' : '';
                
                description += `${team.icon || ''} **${team.name}** ${statusEmoji}\n`;
                description += `Líder: ${leaderInfo}\n`;
                description += `Membros: ${team.members?.length || 0}\n`;
                description += `V: ${team.stats?.victories || 0} | D: ${team.stats?.defeats || 0}\n`;
                if (teamInMatch) {
                    description += `🔴 **Em partida**\n`;
                }
                description += '\n';

                const userIsLeaderOfThisTeam = (team.leaders && team.leaders.includes(message.author.id)) || 
                                              (team.leader === message.author.id);

                const userTeamInMatch = userTeam ? isTeamInMatch(userTeam.id) : false;

                if (!userIsLeaderOfThisTeam && userTeam && !teamInMatch && !userTeamInMatch && buttons.length < 5) {
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`desafiar_${team.id}`)
                            .setLabel(`Desafiar ${team.name}`)
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('⚔️')
                    );
                }
            } catch (error) {
                console.log(`Erro ao buscar informações do time ${team.name}:`, error);
                
                description += `${team.icon || ''} **${team.name}**\n`;
                description += `Líder: Erro ao carregar\n`;
                description += `Membros: ${team.members?.length || 0}\n`;
                description += `V: ${team.stats?.victories || 0} | D: ${team.stats?.defeats || 0}\n\n`;
            }
        }

        embed.setDescription(description);

        const components = [];
        if (buttons.length > 0) {
            components.push(new ActionRowBuilder().addComponents(buttons));
        } else if (userTeam) {
            const userTeamInMatch = isTeamInMatch(userTeam.id);
            if (userTeamInMatch) {
                embed.setFooter({ text: 'Seu time está em uma partida! Finalize antes de desafiar outros times.' });
            } else {
                embed.setFooter({ text: 'Você não pode desafiar seu próprio time ou times que estão em partida!' });
            }
        }

        message.reply({ embeds: [embed], components });
    }
};