module.exports = {
    name: 'rebaixar',
    description: 'Remove a liderança de um membro (mantém no time)',
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
            return message.reply('Apenas o criador do time pode rebaixar líderes!');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('Mencione um líder para rebaixar!');
        }

        if (member.id === team.creator) {
            return message.reply('Você não pode rebaixar o criador do time!');
        }

        if (!team.leaders.includes(member.id)) {
            return message.reply('Este membro não é um líder!');
        }

        team.leaders = team.leaders.filter(id => id !== member.id);
        
        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        message.reply(`${member} foi rebaixado de líder do time **${team.name}** ${team.icon}, mas continua como membro.`);
    }
};