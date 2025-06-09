const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'cancelar',
    description: 'Cancela a partida atual (apenas líderes ou admins)',
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

        const match = Object.values(matches).find(m => 
            m.channels && m.channels.general === message.channel.id && 
            (m.status === 'aguardando_jogadores' || m.status === 'em_andamento')
        );

        if (!match) {
            return message.reply('Nenhuma partida ativa encontrada neste canal!');
        }

        const team1 = teams[match.team1];
        const team2 = teams[match.team2];

        if (!team1 || !team2) {
            return message.reply('Erro: Times da partida não encontrados!');
        }

        const isAdmin = message.member.permissions.has('Administrator');
        const isTeam1Leader = (team1.leaders && team1.leaders.includes(message.author.id)) || 
                             (team1.leader === message.author.id);
        const isTeam2Leader = (team2.leaders && team2.leaders.includes(message.author.id)) || 
                             (team2.leader === message.author.id);

        if (!isAdmin && !isTeam1Leader && !isTeam2Leader) {
            return message.reply('Apenas líderes dos times ou administradores podem cancelar a partida!');
        }

        try {
            const embed = new EmbedBuilder()
                .setTitle('❌ PARTIDA CANCELADA')
                .setDescription(`A partida entre **${team1.name}** ${team1.icon} e **${team2.name}** ${team2.icon} foi cancelada por ${message.author}.\n\n**Motivo:** Cancelamento manual`)
                .setColor('#FF0000');

            const announcementChannel = client.channels.cache.get('1381722215812169910');
            if (announcementChannel) {
                await announcementChannel.send({ embeds: [embed] });
            }

            const category = message.guild.channels.cache.get(match.channels.category);
            if (category) {
                for (const child of category.children.cache.values()) {
                    await child.delete();
                }
                await category.delete();
            }

            delete matches[match.id];
            fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erro ao cancelar partida:', error);
            message.reply('Erro ao cancelar a partida!');
        }
    }
};