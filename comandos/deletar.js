const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'deletar',
    description: 'Deleta seu time (apenas líderes)',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        const team = Object.values(teams).find(t => {
            if (t.leaders && Array.isArray(t.leaders)) {
                return t.leaders.includes(message.author.id);
            }
            if (t.leader) {
                return t.leader === message.author.id;
            }
            return false;
        });

        if (!team) {
            return await safeReply(message, 'Você não é líder de nenhum time!');
        }

        const isCreator = team.creator === message.author.id;
        if (!isCreator) {
            return await safeReply(message, 'Apenas o criador do time pode deletar o time!');
        }

        try {
            const role = message.guild.roles.cache.get(team.roleId);
            if (role) {
                try {
                    await role.delete();
                    console.log(`Role ${role.name} deletada com sucesso`);
                } catch (roleError) {
                    console.log('Erro ao deletar role:', roleError.message);
                }
            }

            for (const memberId of team.members || []) {
                try {
                    const member = await message.guild.members.fetch(memberId);
                    if (team.prefix && member.nickname && member.nickname.startsWith(team.prefix)) {
                        const newNickname = member.nickname.replace(team.prefix, '').trim();
                        if (newNickname === member.user.username) {
                            await member.setNickname(null);
                        } else {
                            await member.setNickname(newNickname);
                        }
                    }
                } catch (memberError) {
                    console.log(`Erro ao remover prefixo de ${memberId}:`, memberError.message);
                }
            }

            delete teams[team.id];
            fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

            await safeReply(message, `Time **${team.name}** ${team.icon} foi deletado com sucesso!`);
        } catch (error) {
            console.error('Erro ao deletar time:', error);
            await safeReply(message, 'Erro ao deletar o time!');
        }
    }
};