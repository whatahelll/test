// partidas.js
const { EmbedBuilder } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'partidas',
    description: 'Mostra as partidas ativas no momento',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
        } catch (error) {
            matches = {};
        }

        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        const activeMatches = Object.values(matches).filter(match => 
            match.status === 'aguardando_jogadores' || 
            match.status === 'em_andamento' || 
            match.status === 'votando_vencedor'
        );

        if (activeMatches.length === 0) {
            return await safeReply(message, 'Não há partidas ativas no momento!');
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Partidas Ativas')
            .setColor('#FFD700');

        let description = '';
        for (const match of activeMatches) {
            const team1 = teams[match.team1];
            const team2 = teams[match.team2];
            
            if (team1 && team2) {
                const statusEmoji = {
                    'aguardando_jogadores': '⏳',
                    'em_andamento': '🔥',
                    'votando_vencedor': '🗳️'
                };

                const statusText = {
                    'aguardando_jogadores': 'Aguardando Jogadores',
                    'em_andamento': 'Em Andamento',
                    'votando_vencedor': 'Votando Vencedor'
                };

                description += `${statusEmoji[match.status]} **${team1.name}** ${team1.icon} VS **${team2.name}** ${team2.icon}\n`;
                description += `Status: ${statusText[match.status]}\n`;
                
                if (match.createdAt) {
                    const createdTime = new Date(match.createdAt).toLocaleTimeString('pt-BR');
                    description += `Criada às: ${createdTime}\n`;
                }
                
                description += '\n';
            }
        }

        embed.setDescription(description);
        embed.setFooter({ text: `Total: ${activeMatches.length} partida(s) ativa(s)` });

        await safeReply(message, { embeds: [embed] });
    }
};