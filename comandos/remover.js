module.exports = {
    name: 'remover',
    description: 'Remove um membro do seu time',
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
            return message.reply('Você não é líder de nenhum time!');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('Mencione um membro para remover!');
        }

        if (!team.members.includes(member.id)) {
            return message.reply('Este membro não está no seu time!');
        }

        if (team.leaders && team.leaders.includes(member.id)) {
            return message.reply('Você não pode remover um líder! Use `,rebaixar` primeiro.');
        }

        if (member.id === team.creator) {
            return message.reply('Você não pode remover o criador do time!');
        }

        team.members = team.members.filter(id => id !== member.id);
        
        if (team.leaders && team.leaders.includes(member.id)) {
            team.leaders = team.leaders.filter(id => id !== member.id);
        }

        try {
            await member.roles.remove(team.roleId);
            
            if (team.prefix && member.nickname && member.nickname.startsWith(team.prefix)) {
                const newNickname = member.nickname.replace(team.prefix, '').trim();
                if (newNickname === member.user.username) {
                    await member.setNickname(null);
                } else {
                    await member.setNickname(newNickname);
                }
            }
        } catch (error) {
            console.log('Erro ao remover cargo ou nickname:', error.message);
        }

        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        message.reply(`${member} foi removido do time **${team.name}** ${team.icon}!`);
    }
};