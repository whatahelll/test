const { Events } = require('discord.js');

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
        const member = newState.member;
        
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