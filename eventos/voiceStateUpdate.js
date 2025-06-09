const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    execute: async (oldState, newState) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
        } catch (error) {
            matches = {};
        }

        const targetChannelId = '1367543346469404756';
        const member = newState.member || oldState.member;
        
        if (newState.channelId && (newState.channelId === targetChannelId || isTeamVoiceChannel(newState.channelId, matches))) {
            const userTeam = Object.values(teams).find(team => team.members && team.members.includes(member.id));
            
            if (userTeam) {
                const channel = newState.channel;
                const teamMembersInChannel = channel.members.filter(m => 
                    userTeam.members.includes(m.id)
                );

                if (teamMembersInChannel.size > 5) {
                    const membersArray = Array.from(teamMembersInChannel.values());
                    const lastJoinedMember = membersArray[membersArray.length - 1];
                    
                    try {
                        await lastJoinedMember.voice.disconnect();
                        
                        const embed = {
                            title: '⚠️ Limite de Membros Atingido',
                            description: `${lastJoinedMember.user}, você foi desconectado pois o limite de 5 membros do time **${userTeam.name}** ${userTeam.icon} no canal foi atingido.`,
                            color: parseInt(userTeam.color.replace('#', ''), 16)
                        };
                        
                        try {
                            await lastJoinedMember.send({ embeds: [embed] });
                        } catch (error) {
                            console.log('Não foi possível enviar DM para o usuário');
                        }
                        
                        if (channel.guild) {
                            const logChannel = channel.guild.channels.cache.get('1336151112729755709');
                            if (logChannel) {
                                await logChannel.send({ embeds: [embed] });
                            }
                        }
                        
                    } catch (error) {
                        console.error('Erro ao desconectar membro:', error);
                    }
                }
            }
        }

        for (const matchId in matches) {
            const match = matches[matchId];
            if (match.status === 'em_andamento') {
                const voiceChannel1 = member.guild.channels.cache.get(match.channels.voice1);
                const voiceChannel2 = member.guild.channels.cache.get(match.channels.voice2);

                if (voiceChannel1 && voiceChannel2) {
                    const team1Count = voiceChannel1.members.size;
                    const team2Count = voiceChannel2.members.size;

                    if (team1Count === 0 || team2Count === 0) {
                        try {
                            const team1 = teams[match.team1];
                            const team2 = teams[match.team2];

                            const embed = new EmbedBuilder()
                                .setTitle('❌ PARTIDA CANCELADA')
                                .setDescription(`A partida entre **${team1.name}** ${team1.icon} e **${team2.name}** ${team2.icon} foi cancelada pois não há jogadores suficientes nos canais de voz.\n\n**Motivo:** ${team1Count === 0 ? `Time ${team1.name} sem jogadores` : `Time ${team2.name} sem jogadores`}`)
                                .setColor('#FF0000');

                            const generalChannel = member.guild.channels.cache.get(match.channels.general);
                            if (generalChannel) {
                                await generalChannel.send({ embeds: [embed] });
                            }

                            const announcementChannel = member.guild.channels.cache.get('1381722215812169910');
                            if (announcementChannel) {
                                await announcementChannel.send({ embeds: [embed] });
                            }

                            const category = member.guild.channels.cache.get(match.channels.category);
                            if (category) {
                                for (const child of category.children.cache.values()) {
                                    await child.delete();
                                }
                                await category.delete();
                            }

                            delete matches[matchId];
                            fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

                        } catch (error) {
                            console.error('Erro ao cancelar partida:', error);
                        }
                    }
                }
            }
        }
    }
};

function isTeamVoiceChannel(channelId, matches) {
    for (const match of Object.values(matches)) {
        if (match.channels && (match.channels.voice1 === channelId || match.channels.voice2 === channelId)) {
            return true;
        }
    }
    return false;
}