const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'forcarinicio',
    description: 'Força o início da partida (apenas administradores)',
    execute: async (message, args, client) => {
        console.log('Comando forcarinicio executado por:', message.author.tag);
        
        if (!message.member) {
            console.log('Não é em servidor');
            return await safeReply(message, '❌ Este comando só pode ser usado em servidores!');
        }

        if (!message.member.permissions.has('Administrator')) {
            console.log('Usuário sem permissão de admin:', message.author.tag);
            return await safeReply(message, '❌ Apenas administradores podem usar este comando!');
        }

        console.log('Usuário é admin, prosseguindo...');

        const fs = require('fs');
        
        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
            console.log('Matches carregados:', Object.keys(matches));
        } catch (error) {
            console.log('Erro ao carregar matches:', error);
            matches = {};
        }

        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
            console.log('Teams carregados:', Object.keys(teams));
        } catch (error) {
            console.log('Erro ao carregar teams:', error);
            teams = {};
        }

        console.log('Procurando partida no canal:', message.channel.id);

        const match = Object.values(matches).find(m => {
            console.log('Verificando match:', {
                id: m.id,
                generalChannel: m.channels?.general,
                status: m.status,
                match: m.channels?.general === message.channel.id && m.status === 'aguardando_jogadores'
            });
            return m.channels && m.channels.general === message.channel.id && m.status === 'aguardando_jogadores';
        });

        if (!match) {
            console.log('Nenhuma partida encontrada');
            return await safeReply(message, '❌ Nenhuma partida aguardando jogadores encontrada neste canal!');
        }

        console.log('Partida encontrada:', match.id);

        const team1 = teams[match.team1];
        const team2 = teams[match.team2];

        if (!team1 || !team2) {
            console.log('Times não encontrados');
            return await safeReply(message, '❌ Erro: Times da partida não encontrados!');
        }

        console.log('Times encontrados:', team1.name, 'vs', team2.name);

        const lobbyChannel = client.channels.cache.get(match.lobbyChannelId);
        if (!lobbyChannel) {
            console.log('Canal de lobby não encontrado');
            return await safeReply(message, '❌ Canal de lobby não encontrado!');
        }

        const voiceChannel1 = client.channels.cache.get(match.channels.voice1);
        const voiceChannel2 = client.channels.cache.get(match.channels.voice2);

        if (!voiceChannel1 || !voiceChannel2) {
            console.log('Canais de voz não encontrados');
            return await safeReply(message, '❌ Canais de voz da partida não encontrados!');
        }

        const membersInLobby = lobbyChannel.members;
        const team1Members = membersInLobby.filter(member => member.roles.cache.has(team1.roleId));
        const team2Members = membersInLobby.filter(member => member.roles.cache.has(team2.roleId));

        console.log('Jogadores encontrados:', {
            team1: team1Members.size,
            team2: team2Members.size
        });

        if (team1Members.size === 0 && team2Members.size === 0) {
            return await safeReply(message, '❌ Não há nenhum jogador de ambos os times no canal de lobby!');
        }

        if (team1Members.size === 0) {
            return await safeReply(message, `❌ Não há jogadores do time **${team1.name}** ${team1.icon} no canal de lobby!`);
        }

        if (team2Members.size === 0) {
            return await safeReply(message, `❌ Não há jogadores do time **${team2.name}** ${team2.icon} no canal de lobby!`);
        }

        const team1Players = Array.from(team1Members.values());
        const team2Players = Array.from(team2Members.values());

        let team1Moved = 0;
        let team2Moved = 0;

        console.log('Movendo jogadores...');

        for (const member of team1Players) {
            try {
                await member.voice.setChannel(voiceChannel1);
                team1Moved++;
                console.log(`Movido: ${member.user.username} para team1`);
            } catch (error) {
                console.log(`Erro ao mover ${member.user.username}:`, error.message);
            }
        }

        for (const member of team2Players) {
            try {
                await member.voice.setChannel(voiceChannel2);
                team2Moved++;
                console.log(`Movido: ${member.user.username} para team2`);
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
        match.forcedStart = true;
        match.forcedBy = message.author.id;

        if (match.startVote) {
            delete match.startVote;
        }

        try {
            console.log(`Deletando canal de lobby temporário: ${lobbyChannel.name} (${lobbyChannel.id})`);
            await lobbyChannel.delete();
            console.log('Canal de lobby temporário deletado com sucesso');
            delete match.lobbyChannelId;
        } catch (error) {
            console.log('Erro ao deletar canal de lobby temporário:', error.message);
        }

        matches[match.id] = match;

        try {
            fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));
            console.log('Dados salvos');
        } catch (error) {
            console.error('Erro ao salvar:', error);
        }

        console.log(`Partida ${match.id} iniciada forçadamente, parando monitoramento de timeout`);
        if (client.matchMonitor) {
            client.matchMonitor.stopMonitoringMatch(match.id);
        }

        const responseMessage = `🔥 **PARTIDA INICIADA FORÇADAMENTE POR ADMIN!** 🔥\n\n${team1Moved} jogadores do **${team1.name}** ${team1.icon} vs ${team2Moved} jogadores do **${team2.name}** ${team2.icon} foram movidos para seus canais!\n\n⚠️ **Aviso:** Este início foi forçado por ${message.author}, ignorando o mínimo de 4 jogadores por time.\n\n🗑️ Canal de lobby temporário foi removido.`;
        
        console.log('Enviando resposta');
        await safeReply(message, responseMessage);
    }
};