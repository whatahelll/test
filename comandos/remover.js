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

        if (!team.members || !Array.isArray(team.members)) {
            team.members = [];
        }

        if (!team.members.includes(member.id)) {
            return message.reply('Este membro não está no seu time!');
        }

        const isLeaderOrCreator = team.leaders?.includes(member.id) || team.creator === member.id;
        if (isLeaderOrCreator && message.author.id !== team.creator) {
            return message.reply('Apenas o criador do time pode remover líderes!');
        }

        if (member.id === message.author.id) {
            return message.reply('Você não pode remover a si mesmo! Use `,sair` ou `,deletar`.');
        }

        team.members = team.members.filter(id => id !== member.id);
        
        if (team.leaders && team.leaders.includes(member.id)) {
            team.leaders = team.leaders.filter(id => id !== member.id);
        }

        try {
            await member.roles.remove(team.roleId);
        } catch (error) {
            console.log('Erro ao remover cargo do membro');
        }

        fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

        message.reply(`${member} foi removido do time **${team.name}** ${team.icon}!`);
    }
};