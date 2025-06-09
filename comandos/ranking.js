const { EmbedBuilder } = require('discord.js');

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
            return message.reply('Nenhum time foi criado ainda!');
        }

        const sortedTeams = Object.values(teams).sort((a, b) => {
            const winRateA = a.stats.matches > 0 ? a.stats.victories / a.stats.matches : 0;
            const winRateB = b.stats.matches > 0 ? b.stats.victories / b.stats.matches : 0;
            return winRateB - winRateA || b.stats.victories - a.stats.victories;
        });

        const embed = new EmbedBuilder()
            .setTitle('🏆 Ranking dos Times 🏆')
            .setColor('#FFD700');

        let description = '';
        sortedTeams.forEach((team, index) => {
            const winRate = team.stats.matches > 0 ? ((team.stats.victories / team.stats.matches) * 100).toFixed(1) : 0;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
            
            description += `${medal} ${team.icon} **${team.name}**\n`;
            description += `Vitórias: ${team.stats.victories} | Derrotas: ${team.stats.defeats}\n`;
            description += `Taxa de vitória: ${winRate}% | Partidas: ${team.stats.matches}\n\n`;
        });

        embed.setDescription(description);
        message.reply({ embeds: [embed] });
    }
};