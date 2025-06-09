module.exports = {
    name: 'sair',
    description: 'Sair do seu time atual',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        const userTeam = Object.values(teams).find(team => team.members.includes(message.author.id));
        if (!userTeam) {
            return message.reply('Você não está em nenhum time!');
        }

        if (userTeam.leader === message.author.id) {
            return message.reply('Líderes não podem sair do próprio time! Use `,deletar` para deletar o time.');
        }

        userTeam.members = userTeam.members.filter(id => id !== message.author.id);
        await message.member.roles.remove(userTeam.roleId);

        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        message.reply(`Você saiu do time **${userTeam.name}** ${userTeam.icon}!`);
    }
};