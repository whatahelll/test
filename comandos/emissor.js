const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'emissor',
    description: 'Adiciona um emissor para compartilhar tela da partida',
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

        const isTeam1Leader = (team1.leaders && team1.leaders.includes(message.author.id)) || 
                             (team1.leader === message.author.id);
        const isTeam2Leader = (team2.leaders && team2.leaders.includes(message.author.id)) || 
                             (team2.leader === message.author.id);

        if (!isTeam1Leader && !isTeam2Leader) {
            return await safeReply(message, 'Apenas líderes dos times podem escolher um emissor!');
        }

        if (match.emissor) {
            return await safeReply(message, `❌ Já existe um emissor escolhido para esta partida: <@${match.emissor}>!`);
        }

        const member = message.mentions.members.first();
        if (!member) {
            return await safeReply(message, 'Mencione um membro para ser o emissor!\n**Exemplo:** `,emissor @usuario`');
        }

        try {
            const category = message.guild.channels.cache.get(match.channels.category);
            if (!category) {
                return await safeReply(message, 'Categoria da partida não encontrada!');
            }

            const spectatorChannel = await message.guild.channels.create({
                name: '📺-espectador',
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                        deny: [PermissionFlagsBits.Stream]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel, 
                            PermissionFlagsBits.Connect, 
                            PermissionFlagsBits.Stream,
                            PermissionFlagsBits.UseVAD
                        ]
                    },
                    {
                        id: team1.roleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                    },
                    {
                        id: team2.roleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                    }
                ]
            });

            match.emissor = member.id;
            match.channels.spectator = spectatorChannel.id;

            fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'Emissor Escolhido!',
                    iconURL: member.user.avatarURL()
                })
                .setDescription(`${member} foi escolhido como emissor da partida!\n\n📺 **Canal criado:** ${spectatorChannel}\n\n⚡ O emissor pode compartilhar tela neste canal e qualquer pessoa pode assistir.`)
                .setColor('#9146FF')
                .addFields(
                    { name: '🎮 Partida', value: `**${team1.name}** ${team1.icon} VS **${team2.name}** ${team2.icon}`, inline: false },
                    { name: '📺 Emissor', value: `${member}`, inline: true },
                    { name: '👑 Escolhido por', value: `${message.author}`, inline: true }
                )
                .setFooter({ 
                    text: 'O canal será deletado quando a partida terminar'
                });

            await safeReply(message, { embeds: [embed] });

            try {
                await spectatorChannel.send({ 
                    content: `🎮 **TRANSMISSÃO DA PARTIDA**\n\n📺 **Emissor:** ${member}\n🏆 **Partida:** **${team1.name}** ${team1.icon} VS **${team2.name}** ${team2.icon}\n\n⚡ ${member}, você pode compartilhar sua tela aqui!\n👥 Todos podem entrar para assistir a transmissão.`,
                    embeds: [embed]
                });
            } catch (error) {
                console.log('Erro ao enviar mensagem no canal espectador:', error);
            }

        } catch (error) {
            console.error('Erro ao criar canal espectador:', error);
            await safeReply(message, 'Erro ao criar o canal de espectador!');
        }
    }
};