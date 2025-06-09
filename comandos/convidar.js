module.exports = {
    name: 'convidar',
    description: 'Convida um membro para seu time',
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
            return message.reply('Mencione um membro para convidar!');
        }

        if (team.members.includes(member.id)) {
            return message.reply('Este membro já está no seu time!');
        }

        if (Object.values(teams).some(t => t.members.includes(member.id))) {
            return message.reply('Este membro já está em outro time!');
        }

        team.members.push(member.id);
        await member.roles.add(team.roleId);

        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        message.reply(`${member} foi adicionado ao time **${team.name}** ${team.icon}!`);
    }
};