// comandos/times.js (atualizado sem botões de desafio)
const { EmbedBuilder } = require('discord.js');
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

        const embed = new EmbedBuilder()
            .setTitle('🔥 Times Free Fire 🔥')
            .setDescription('Lista de todos os times disponíveis:')
            .setColor('#FF6B35')
            .setFooter({ text: 'Use ,desafiar @NomeDoTime para desafiar um time!' });

        let description = '';

        for (const team of Object.values(teams)) {
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
        await safeReply(message, { embeds: [embed] });
    }
};