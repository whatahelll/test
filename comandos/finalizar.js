const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'finalizar',
    description: 'Finaliza a partida',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
        } catch (error) {
            matches = {};
        }

        const match = Object.values(matches).find(m => 
            m.channels.general === message.channel.id && m.status === 'em_andamento'
        );

        if (!match) {
            return message.reply('Nenhuma partida ativa encontrada neste canal!');
        }

        const allPlayers = [...match.players.team1, ...match.players.team2];
        if (!allPlayers.includes(message.author.id)) {
            return message.reply('Apenas jogadores da partida podem finalizar!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🏁 Finalizar Partida')
            .setDescription('Votação para finalizar a partida')
            .setColor('#FFD700');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`finalizar_sim_${match.id}`)
                    .setLabel('Sim')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`finalizar_nao_${match.id}`)
                    .setLabel('Não')
                    .setStyle(ButtonStyle.Danger)
            );

        const voteMessage = await message.reply({ embeds: [embed], components: [row] });
        
        match.finishVote = {
            messageId: voteMessage.id,
            yes: [],
            no: [],
            requiredVotes: Math.ceil(allPlayers.length / 2)
        };

        matches[match.id] = match;
        fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));
    }
};