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

        const team = Object.values(teams).find(t => t.leader === message.author.id);
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

        if (member.id === team.leader) {
            return message.reply('Você não pode remover a si mesmo!');
        }

        team.members = team.members.filter(id => id !== member.id);
        await member.roles.remove(team.roleId);

        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        message.reply(`${member} foi removido do time **${team.name}** ${team.icon}!`);
    }
};