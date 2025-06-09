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
            return await safeReply(message, 'Nenhuma partida ativa encontrada neste canal!');
        }

        const team1 = teams[match.team1];
        const team2 = teams[match.team2];

        if (!team1 || !team2) {
            return await safeReply(message, 'Erro: Times da partida não encontrados!');
        }

        const isAdmin = message.member.permissions.has('Administrator');
        const isTeam1Leader = (team1.leaders && team1.leaders.includes(message.author.id)) || 
                             (team1.leader === message.author.id);
        const isTeam2Leader = (team2.leaders && team2.leaders.includes(message.author.id)) || 
                             (team2.leader === message.author.id);

        if (!isAdmin && !isTeam1Leader && !isTeam2Leader) {
            return await safeReply(message, 'Apenas líderes dos times ou administradores podem cancelar a partida!');
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

            if (match.lobbyChannelId) {
                const lobbyChannel = client.channels.cache.get(match.lobbyChannelId);
                if (lobbyChannel) {
                    try {
                        console.log(`Deletando canal de lobby temporário: ${lobbyChannel.name} (${lobbyChannel.id})`);
                        await lobbyChannel.delete();
                        console.log('Canal de lobby temporário deletado');
                    } catch (error) {
                        console.log('Erro ao deletar canal de lobby temporário:', error.message);
                    }
                }
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

            await safeReply(message, { embeds: [embed] });

        } catch (error) {
            console.error('Erro ao cancelar partida:', error);
            await safeReply(message, 'Erro ao cancelar a partida!');
        }
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