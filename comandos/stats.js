const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    description: 'Mostra as estatísticas do seu time',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        const team = Object.values(teams).find(t => t.members.includes(message.author.id));
        if (!team) {
            return message.reply('Você não está em nenhum time!');
        }

        const winRate = team.stats.matches > 0 ? ((team.stats.victories / team.stats.matches) * 100).toFixed(1) : 0;
        
        let membersInfo = '';
        let leadersInfo = '';
        
        for (const memberId of team.members) {
            try {
                const user = await client.users.fetch(memberId);
                const isLeader = team.leaders.includes(memberId);
                const isCreator = team.creator === memberId;
                
                if (isLeader) {
                    leadersInfo += `${isCreator ? '👑' : '⭐'} ${user.username}\n`;
                } else {
                    membersInfo += `👤 ${user.username}\n`;
                }
            } catch (error) {
                console.log(`Erro ao buscar usuário ${memberId}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`${team.icon} Estatísticas do Time ${team.name}`)
            .setColor(team.color)
            .setThumbnail(message.guild.iconURL())
            .addFields(
                { name: '📊 Estatísticas de Partidas', value: `**Vitórias:** ${team.stats.victories}\n**Derrotas:** ${team.stats.defeats}\n**Total de Partidas:** ${team.stats.matches}\n**Taxa de Vitória:** ${winRate}%`, inline: false },
                { name: '👑 Líderes', value: leadersInfo || 'Nenhum líder', inline: true },
                { name: '👥 Membros', value: membersInfo || 'Nenhum membro', inline: true },
                { name: '📈 Informações Gerais', value: `**Total de Membros:** ${team.members.length}\n**Criado em:** ${new Date(team.createdAt).toLocaleDateString('pt-BR')}\n**Cor do Time:** ${team.color}`, inline: false }
            )
            .setFooter({ text: `👑 = Criador | ⭐ = Líder | 👤 = Membro` });

        message.reply({ embeds: [embed] });
    }
};