const { EmbedBuilder } = require('discord.js');

module.exports = {
   name: 'editar',
   description: 'Edita o ícone e prefixo do seu time',
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

       if (args.length === 0) {
           const embed = new EmbedBuilder()
               .setTitle(`⚙️ Editar Time ${team.name}`)
               .setDescription('**Comandos disponíveis:**\n\n`,editar icone <emoji>` - Altera o ícone do cargo\n`,editar prefixo <texto>` - Define prefixo do time (será automaticamente colocado entre [])\n`,editar prefixo remover` - Remove o prefixo')
               .setColor(team.color)
               .addFields(
                   { name: 'Ícone Atual', value: team.icon, inline: true },
                   { name: 'Prefixo Atual', value: team.prefix || 'Nenhum', inline: true }
               );

           return message.reply({ embeds: [embed] });
       }

       const subcommand = args[0].toLowerCase();

       if (subcommand === 'icone') {
           const newIcon = args[1];
           if (!newIcon) {
               return message.reply('Forneça um emoji para o ícone! Exemplo: `,editar icone 🔥`');
           }

           try {
               const role = message.guild.roles.cache.get(team.roleId);
               if (!role) {
                   return message.reply('Cargo do time não encontrado!');
               }

               await role.setIcon(newIcon);
               
               team.icon = newIcon;
               fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

               const embed = new EmbedBuilder()
                   .setTitle('✅ Ícone Atualizado!')
                   .setDescription(`O ícone do time **${team.name}** foi alterado para ${newIcon}`)
                   .setColor(team.color);

               message.reply({ embeds: [embed] });

           } catch (error) {
               console.error('Erro ao alterar ícone:', error);
               if (error.code === 50013) {
                   message.reply('❌ Não tenho permissão para alterar este cargo!');
               } else if (error.code === 50035) {
                   message.reply('❌ Emoji inválido! Use apenas emojis padrão ou do servidor.');
               } else {
                   message.reply('❌ Erro ao alterar o ícone do cargo!');
               }
           }
       }

       else if (subcommand === 'prefixo') {
           if (args[1] === 'remover') {
               delete team.prefix;
               fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

               await updateMemberNicknames(message.guild, team, null);

               const embed = new EmbedBuilder()
                   .setTitle('✅ Prefixo Removido!')
                   .setDescription(`O prefixo do time **${team.name}** foi removido`)
                   .setColor(team.color);

               return message.reply({ embeds: [embed] });
           }

           const prefixText = args.slice(1).join(' ');
           if (!prefixText) {
               return message.reply('Forneça um prefixo! Exemplo: `,editar prefixo FIRE`');
           }

           if (prefixText.length > 8) {
               return message.reply('O prefixo deve ter no máximo 8 caracteres!');
           }

           const newPrefix = `[${prefixText}]`;
           team.prefix = newPrefix;
           fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));

           await updateMemberNicknames(message.guild, team, newPrefix);

           const embed = new EmbedBuilder()
               .setTitle('✅ Prefixo Atualizado!')
               .setDescription(`O prefixo do time **${team.name}** foi alterado para **${newPrefix}**\n\nTodos os membros do time agora terão este prefixo antes do nome.`)
               .setColor(team.color);

           message.reply({ embeds: [embed] });
       }

       else {
           message.reply('Subcomando inválido! Use `,editar` para ver os comandos disponíveis.');
       }
   }
};

async function updateMemberNicknames(guild, team, prefix) {
   for (const memberId of team.members) {
       try {
           const member = await guild.members.fetch(memberId);
           let newNickname;

           if (prefix) {
               const baseName = member.user.username;
               const currentNick = member.nickname || baseName;
               
               let cleanName = currentNick;
               if (team.prefix && currentNick.startsWith(team.prefix)) {
                   cleanName = currentNick.replace(team.prefix, '').trim();
               }

               newNickname = `${prefix}${cleanName}`;
               
               if (newNickname.length > 32) {
                   newNickname = newNickname.substring(0, 32);
               }
           } else {
               const currentNick = member.nickname;
               if (currentNick && team.prefix && currentNick.startsWith(team.prefix)) {
                   newNickname = currentNick.replace(team.prefix, '').trim();
                   if (newNickname === member.user.username) {
                       newNickname = null;
                   }
               }
           }

           if (newNickname !== undefined) {
               await member.setNickname(newNickname);
           }

       } catch (error) {
           console.log(`Erro ao alterar nickname de ${memberId}:`, error.message);
       }
   }
}