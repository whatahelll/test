module.exports = {
    name: 'promover',
    description: 'Promove um membro a líder do time',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        const team = Object.values(teams).find(t => t.creator === message.author.id);
        if (!team) {
            return message.reply('Apenas o criador do time pode promover membros a líderes!');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('Mencione um membro para promover!');
        }

        if (!team.members.includes(member.id)) {
            return message.reply('Este usuário não é membro do seu time!');
        }

        if (team.leaders.includes(member.id)) {
            return message.reply('Este membro já é um líder!');
        }

        team.leaders.push(member.id);
        
        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        message.reply(`${member} foi promovido a líder do time **${team.name}** ${team.icon}! ⭐`);
    }
};