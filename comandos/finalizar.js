const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
   name: 'finalizar',
   description: 'Finaliza a partida',
   execute: async (message, args, client) => {
       const fs = require('fs');
       
       let matches = {};
       try {
           matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
       } catch (error) {
           matches = {};
       }

       const match = Object.values(matches).find(m => 
           m.channels.general === message.channel.id && m.status === 'em_andamento'
       );

       if (!match) {
           return await safeReply(message, 'Nenhuma partida ativa encontrada neste canal!');
       }

       const allPlayers = [...match.players.team1, ...match.players.team2];
       if (!allPlayers.includes(message.author.id)) {
           return await safeReply(message, 'Apenas jogadores da partida podem finalizar!');
       }

       if (match.finishVote) {
           return await safeReply(message, 'Já existe uma votação para finalizar em andamento!');
       }

       const embed = new EmbedBuilder()
           .setAuthor({ 
               name: 'Finalizar Partida',
               iconURL: message.author.avatarURL()
           })
           .setDescription('Votação para finalizar a partida\n\n⏰ **30 segundos para votar**')
           .setColor('#FFD700')
           .setFooter({ 
               text: 'Vote se a partida deve ser finalizada'
           });

       const row = new ActionRowBuilder()
           .addComponents(
               new ButtonBuilder()
                   .setCustomId(`finalizar_sim_${match.id}`)
                   .setLabel('Sim')
                   .setStyle(ButtonStyle.Success),
               new ButtonBuilder()
                   .setCustomId(`finalizar_nao_${match.id}`)
                   .setLabel('Não')
                   .setStyle(ButtonStyle.Danger)
           );

       const voteMessage = await safeReply(message, { embeds: [embed], components: [row] });
       
       if (!voteMessage) {
           return;
       }

       match.finishVote = {
           messageId: voteMessage.id,
           yes: [],
           no: []
       };

       matches[match.id] = match;
       fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

       setTimeout(async () => {
           await processFinishVoteResult(client, match, allPlayers, voteMessage);
       }, 30000);
   }
};

async function processFinishVoteResult(client, match, allPlayers, voteMessage) {
   const fs = require('fs');
   
   let matches = {};
   try {
       matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
   } catch (error) {
       matches = {};
   }
   
   const updatedMatch = matches[match.id];
   if (!updatedMatch || !updatedMatch.finishVote) return;

   const yesVotes = updatedMatch.finishVote.yes.length;
   const noVotes = updatedMatch.finishVote.no.length;

   try {
       await voteMessage.edit({ components: [] });
   } catch (error) {
       console.log('Erro ao editar mensagem de votação');
   }

   if (yesVotes > noVotes) {
       let teams = {};
       try {
           teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
       } catch (error) {
           teams = {};
       }

       const team1 = teams[updatedMatch.team1];
       const team2 = teams[updatedMatch.team2];

       updatedMatch.winnerVote = {
           team1Votes: [],
           team2Votes: [],
           round: 1
       };

       const embed = new EmbedBuilder()
           .setAuthor({ 
               name: 'Qual time ganhou?',
               iconURL: voteMessage.guild.iconURL()
           })
           .setDescription(`**${team1.name}** ${team1.icon} VS **${team2.name}** ${team2.icon}\n\n⏰ Votação de 30 segundos`)
           .setColor('#FFD700')
           .setFooter({ 
               text: 'Vote no time vencedor'
           });

       const row = new ActionRowBuilder()
           .addComponents(
               new ButtonBuilder()
                   .setCustomId(`vencedor_${updatedMatch.team1}_${updatedMatch.id}`)
                   .setLabel(`${team1.name} ${team1.icon}`)
                   .setStyle(ButtonStyle.Primary),
               new ButtonBuilder()
                   .setCustomId(`vencedor_${updatedMatch.team2}_${updatedMatch.id}`)
                   .setLabel(`${team2.name} ${team2.icon}`)
                   .setStyle(ButtonStyle.Primary)
           );

       const channel = client.channels.cache.get(updatedMatch.channels.general) || 
                      await client.channels.fetch(updatedMatch.channels.general).catch(() => null);
       
       if (channel) {
           try {
               const winnerVoteMessage = await channel.send({ embeds: [embed], components: [row] });
               
               updatedMatch.status = 'votando_vencedor';
               delete updatedMatch.finishVote;
               fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

               setTimeout(async () => {
                   await processWinnerVoteResult(client, updatedMatch, team1, team2, allPlayers, winnerVoteMessage);
               }, 30000);
           } catch (error) {
               console.error('Erro ao enviar mensagem de vencedor:', error);
           }
       }
   } else {
       const channel = client.channels.cache.get(updatedMatch.channels.general) || 
                      await client.channels.fetch(updatedMatch.channels.general).catch(() => null);
       
       if (channel) {
           const embed = new EmbedBuilder()
               .setAuthor({ 
                   name: 'Votação para Finalizar Rejeitada',
                   iconURL: channel.guild.iconURL()
               })
               .setDescription(`A votação para finalizar a partida foi rejeitada.\n\n**Resultado:** ${yesVotes} sim / ${noVotes} não\n\nA partida continua.`)
               .setColor('#FF0000')
               .setFooter({ 
                   text: 'A partida continua em andamento'
               });

           try {
               await channel.send({ embeds: [embed] });
           } catch (error) {
               console.error('Erro ao enviar mensagem de rejeição:', error);
           }
       }

       delete updatedMatch.finishVote;
       fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));
   }
}

async function processWinnerVoteResult(client, match, team1, team2, allPlayers, voteMessage) {
   const fs = require('fs');
   
   let matches = {};
   try {
       matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
       teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
  } catch (error) {
      teams = {};
  }
  
  const updatedMatch = matches[match.id];
  if (!updatedMatch || !updatedMatch.winnerVote) return;

  const team1Votes = updatedMatch.winnerVote.team1Votes.length;
  const team2Votes = updatedMatch.winnerVote.team2Votes.length;

  if (team1Votes === team2Votes) {
      updatedMatch.winnerVote.team1Votes = [];
      updatedMatch.winnerVote.team2Votes = [];
      updatedMatch.winnerVote.round++;

      try {
          await voteMessage.delete();
      } catch (error) {
          console.log('Erro ao deletar mensagem de votação');
      }

      const embed = new EmbedBuilder()
          .setAuthor({ 
              name: 'Empate na Votação!',
              iconURL: voteMessage.guild.iconURL()
          })
          .setDescription(`Houve empate! Iniciando nova votação...\n\n**${team1.name}** ${team1.icon} VS **${team2.name}** ${team2.icon}\n\n⏰ Votação de 30 segundos (Rodada ${updatedMatch.winnerVote.round})`)
          .setColor('#FFA500')
          .setFooter({ 
              text: `Rodada ${updatedMatch.winnerVote.round} de votação`
          });

      const row = new ActionRowBuilder()
          .addComponents(
              new ButtonBuilder()
                  .setCustomId(`vencedor_${updatedMatch.team1}_${updatedMatch.id}`)
                  .setLabel(`${team1.name} ${team1.icon}`)
                  .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                  .setCustomId(`vencedor_${updatedMatch.team2}_${updatedMatch.id}`)
                  .setLabel(`${team2.name} ${team2.icon}`)
                  .setStyle(ButtonStyle.Primary)
          );

      const channel = client.channels.cache.get(updatedMatch.channels.general) || 
                     await client.channels.fetch(updatedMatch.channels.general).catch(() => null);
      
      if (channel) {
          try {
              const newVoteMessage = await channel.send({ embeds: [embed], components: [row] });
              
              fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

              setTimeout(async () => {
                  await processWinnerVoteResult(client, updatedMatch, team1, team2, allPlayers, newVoteMessage);
              }, 30000);
          } catch (error) {
              console.error('Erro ao enviar nova votação:', error);
          }
      }
  } else {
      const finalWinnerTeamId = team1Votes > team2Votes ? updatedMatch.team1 : updatedMatch.team2;
      const loserTeamId = finalWinnerTeamId === updatedMatch.team1 ? updatedMatch.team2 : updatedMatch.team1;

      const winnerTeam = teams[finalWinnerTeamId];
      const loserTeam = teams[loserTeamId];

      if (winnerTeam && loserTeam) {
          winnerTeam.stats.victories++;
          winnerTeam.stats.matches++;
          loserTeam.stats.defeats++;
          loserTeam.stats.matches++;

          try {
              const guild = voteMessage.guild || client.guilds.cache.first();
              
              if (updatedMatch.lobbyChannelId) {
                  const lobbyChannel = guild.channels.cache.get(updatedMatch.lobbyChannelId);
                  if (lobbyChannel) {
                      try {
                          console.log(`Deletando canal de lobby temporário: ${lobbyChannel.name} (${lobbyChannel.id})`);
                          await lobbyChannel.delete();
                          console.log('Canal de lobby temporário deletado');
                      } catch (error) {
                          console.log('Erro ao deletar canal de lobby temporário:', error.message);
                      }
                  }
              }
              
              const category = guild.channels.cache.get(updatedMatch.channels.category);
              if (category) {
                  for (const child of category.children.cache.values()) {
                      await child.delete();
                  }
                  await category.delete();
              }
          } catch (error) {
              console.log('Erro ao deletar canais');
          }

          delete matches[updatedMatch.id];
          fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));
          fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));

          const embed = new EmbedBuilder()
              .setAuthor({ 
                  name: 'PARTIDA FINALIZADA!',
                  iconURL: winnerTeam.icon || voteMessage.guild.iconURL()
              })
              .setDescription(`**${winnerTeam.name}** ${winnerTeam.icon} VENCEU!\n\n**Estatísticas atualizadas:**\n${winnerTeam.icon} **${winnerTeam.name}**: ${winnerTeam.stats.victories}V - ${winnerTeam.stats.defeats}D\n${loserTeam.icon} **${loserTeam.name}**: ${loserTeam.stats.victories}V - ${loserTeam.stats.defeats}D`)
              .setColor('#00FF00')
              .setFooter({ 
                  text: 'Parabéns ao time vencedor!'
              });

          const announcementChannel = client.channels.cache.get('1381722215812169910');
          if (announcementChannel) {
              try {
                  await announcementChannel.send({ embeds: [embed] });
              } catch (error) {
                  console.error('Erro ao enviar anúncio:', error);
              }
          }

          try {
              await voteMessage.delete();
          } catch (error) {
              console.log('Erro ao deletar mensagem de votação');
          }
      }
  }
}