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

        const team = Object.values(teams).find(t => t.leader === message.author.id);
        if (!team) {
            return message.reply('Você não é líder de nenhum time!');
        }

        try {
            const role = message.guild.roles.cache.get(team.roleId);
            if (role) await role.delete();

            delete teams[team.id];
            fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

            message.reply(`Time **${team.name}** ${team.icon} foi deletado com sucesso!`);
        } catch (error) {
            console.error(error);
            message.reply('Erro ao deletar o time!');
        }
    }
};