module.exports = {
    name: 'iniciar',
    description: 'Inicia a partida movendo jogadores',
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
            m.channels.general === message.channel.id && m.status === 'aguardando_jogadores'
        );

        if (!match) {
            return message.reply('Nenhuma partida encontrada neste canal!');
        }

        const team1 = teams[match.team1];
        const team2 = teams[match.team2];

        if (message.author.id !== team1.leader && message.author.id !== team2.leader) {
            return message.reply('Apenas os líderes dos times podem iniciar a partida!');
        }

        const lobbyChannel = client.channels.cache.get('1367543346469404756');
        const voiceChannel1 = client.channels.cache.get(match.channels.voice1);
        const voiceChannel2 = client.channels.cache.get(match.channels.voice2);

        const membersInLobby = lobbyChannel.members;
        const team1Members = membersInLobby.filter(member => member.roles.cache.has(team1.roleId));
        const team2Members = membersInLobby.filter(member => member.roles.cache.has(team2.roleId));

        const team1Players = team1Members.first(4);
        const team2Players = team2Members.first(4);

        for (const member of team1Players) {
            try {
                await member.voice.setChannel(voiceChannel1);
            } catch (error) {
                console.log(`Erro ao mover ${member.user.username}`);
            }
        }

        for (const member of team2Players) {
            try {
                await member.voice.setChannel(voiceChannel2);
            } catch (error) {
                console.log(`Erro ao mover ${member.user.username}`);
            }
        }

        match.status = 'em_andamento';
        match.players = {
            team1: team1Players.map(m => m.id),
            team2: team2Players.map(m => m.id)
        };

        fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

        message.reply(`🔥 Partida iniciada! ${team1Players.size} jogadores do **${team1.name}** vs ${team2Players.size} jogadores do **${team2.name}**!`);
    }
};