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
            return await safeReply(message, 'Nenhuma partida encontrada neste canal!');
        }

        const team1 = teams[match.team1];
        const team2 = teams[match.team2];

        if (!team1 || !team2) {
            return await safeReply(message, 'Erro: Times da partida não encontrados!');
        }

        const isTeam1Leader = (team1.leaders && team1.leaders.includes(message.author.id)) || 
                             (team1.leader === message.author.id);
        const isTeam2Leader = (team2.leaders && team2.leaders.includes(message.author.id)) || 
                             (team2.leader === message.author.id);

        if (!isTeam1Leader && !isTeam2Leader) {
            return await safeReply(message, 'Apenas os líderes dos times podem iniciar a partida!');
        }

        const lobbyChannel = client.channels.cache.get(match.lobbyChannelId);
        if (!lobbyChannel) {
            return await safeReply(message, 'Canal de lobby não encontrado!');
        }

        const membersInLobby = lobbyChannel.members;
        const team1Members = membersInLobby.filter(member => member.roles.cache.has(team1.roleId));
        const team2Members = membersInLobby.filter(member => member.roles.cache.has(team2.roleId));

        if (team1Members.size < 4) {
            return await safeReply(message, `❌ O time **${team1.name}** ${team1.icon} precisa de pelo menos 4 jogadores no canal de lobby! (Atual: ${team1Members.size}/4)\n✅ O time **${team2.name}** ${team2.icon} possui ${team2Members.size} jogadores no lobby.`);
        }

        if (team2Members.size < 4) {
            return await safeReply(message, `❌ O time **${team2.name}** ${team2.icon} precisa de pelo menos 4 jogadores no canal de lobby! (Atual: ${team2Members.size}/4)\n✅ O time **${team1.name}** ${team1.icon} possui ${team1Members.size} jogadores no lobby.`);
        }

        if (!match.startVote) {
            match.startVote = {
                team1Ready: false,
                team2Ready: false,
                team1Leader: null,
                team2Leader: null
            };
        }

        if (isTeam1Leader) {
            if (match.startVote.team1Ready && match.startVote.team1Leader === message.author.id) {
                return await safeReply(message, 'Você já confirmou o início! Aguardando confirmação do outro líder...');
            }
            match.startVote.team1Ready = true;
            match.startVote.team1Leader = message.author.id;
        }

        if (isTeam2Leader) {
            if (match.startVote.team2Ready && match.startVote.team2Leader === message.author.id) {
                return await safeReply(message, 'Você já confirmou o início! Aguardando confirmação do outro líder...');
            }
            match.startVote.team2Ready = true;
            match.startVote.team2Leader = message.author.id;
        }

        fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

        if (!match.startVote.team1Ready || !match.startVote.team2Ready) {
            const team1Status = match.startVote.team1Ready ? '✅' : '⏳';
            const team2Status = match.startVote.team2Ready ? '✅' : '⏳';
            
            return await safeReply(message, `**Confirmação de Início:**\n${team1Status} ${team1.name} ${team1.icon} (${team1Members.size} jogadores)\n${team2Status} ${team2.name} ${team2.icon} (${team2Members.size} jogadores)\n\n${match.startVote.team1Ready && match.startVote.team2Ready ? 'Ambos confirmaram!' : 'Aguardando confirmação do outro líder...'}`);
        }

        const voiceChannel1 = client.channels.cache.get(match.channels.voice1);
        const voiceChannel2 = client.channels.cache.get(match.channels.voice2);

        if (!voiceChannel1 || !voiceChannel2) {
            return await safeReply(message, 'Canais de voz da partida não encontrados!');
        }

        const team1Players = team1Members.first(4);
        const team2Players = team2Members.first(4);

        let team1Moved = 0;
        let team2Moved = 0;

        for (const member of team1Players) {
            try {
                await member.voice.setChannel(voiceChannel1);
                team1Moved++;
            } catch (error) {
                console.log(`Erro ao mover ${member.user.username}:`, error.message);
            }
        }

        for (const member of team2Players) {
            try {
                await member.voice.setChannel(voiceChannel2);
                team2Moved++;
            } catch (error) {
                console.log(`Erro ao mover ${member.user.username}:`, error.message);
            }
        }

        match.status = 'em_andamento';
        match.players = {
            team1: team1Players.map(m => m.id),
            team2: team2Players.map(m => m.id)
        };

        match.startedAt = new Date().toISOString();

        delete match.startVote;

        try {
            console.log(`Deletando canal de lobby temporário: ${lobbyChannel.name} (${lobbyChannel.id})`);
            await lobbyChannel.delete();
            console.log('Canal de lobby temporário deletado com sucesso');
            delete match.lobbyChannelId;
        } catch (error) {
            console.log('Erro ao deletar canal de lobby temporário:', error.message);
        }

        fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

        console.log(`Partida ${match.id} iniciada, parando monitoramento de timeout`);
        if (client.matchMonitor) {
            client.matchMonitor.stopMonitoringMatch(match.id);
        }

        await safeReply(message, `🔥 **PARTIDA INICIADA!** 🔥\n\n${team1Moved} jogadores do **${team1.name}** ${team1.icon} vs ${team2Moved} jogadores do **${team2.name}** ${team2.icon} foram movidos para seus canais!\n\n🗑️ Canal de lobby temporário foi removido.`);
    }
};

async function safeReply(message, content) {
    try {
        if (message.channel && message.channel.isTextBased()) {
            return await message.reply(content);
        } else {
            console.log('Canal não está disponível no cache, tentando buscar...');
            const channel = await message.client.channels.fetch(message.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                return await channel.send(typeof content === 'string' ? content : content.embeds ? { embeds: content.embeds } : content);
            } else {
                console.log('Não foi possível enviar mensagem - canal não encontrado');
                return null;
            }
        }
    } catch (error) {
        console.error('Erro ao responder mensagem:', error);
        try {
            const channel = await message.client.channels.fetch(message.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                const safeContent = typeof content === 'string' ? content : 'Erro ao processar comando.';
                return await channel.send(safeContent);
            }
        } catch (fallbackError) {
            console.error('Erro no fallback de resposta:', fallbackError);
        }
        return null;
    }
}