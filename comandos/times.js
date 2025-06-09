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
            try {
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

                description += `${team.icon} **${team.name}**\n`;
                description += `Líder: ${leaderInfo}\n`;
                description += `Membros: ${team.members?.length || 0}\n`;
                description += `V: ${team.stats?.victories || 0} | D: ${team.stats?.defeats || 0}\n\n`;

                const userIsLeader = (team.leaders && team.leaders.includes(message.author.id)) || 
                                   (team.leader === message.author.id);

                if (!userIsLeader && buttons.length < 5) {
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
                
                description += `${team.icon} **${team.name}**\n`;
                description += `Líder: Erro ao carregar\n`;
                description += `Membros: ${team.members?.length || 0}\n`;
                description += `V: ${team.stats?.victories || 0} | D: ${team.stats?.defeats || 0}\n\n`;
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