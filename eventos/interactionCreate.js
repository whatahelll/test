// eventos/interactionCreate.js (arquivo completo atualizado)
const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

let teams = {};
let matches = {};
let invites = {};

function loadData() {
   try {
       teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
   } catch (error) {
       teams = {};
   }

   try {
       matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
   } catch (error) {
       matches = {};
   }

   try {
       invites = JSON.parse(fs.readFileSync('./dados/convites.json', 'utf8'));
   } catch (error) {
       invites = {};
   }
   console.log('Dados carregados. Convites:', Object.keys(invites));
}

function saveData() {
   try {
       if (!fs.existsSync('./dados')) fs.mkdirSync('./dados');
       fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));
       fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));
       fs.writeFileSync('./dados/convites.json', JSON.stringify(invites, null, 2));
       console.log('Dados salvos com sucesso');
   } catch (error) {
       console.error('Erro ao salvar dados:', error);
   }
}

function isTeamInMatch(teamId) {
   return Object.values(matches).some(match => 
       (match.team1 === teamId || match.team2 === teamId) && 
       (match.status === 'aguardando_jogadores' || match.status === 'em_andamento' || match.status === 'votando_vencedor')
   );
}

async function createLobbyChannel(guild, challengerTeam, targetTeam) {
   const channelNames = [];
   
   for (let i = 1; i <= 100; i++) {
       const baseChannelName = `🎮｜lobby-${i}`;
       const existingChannel = guild.channels.cache.find(channel => 
           channel.name === baseChannelName || channel.name === baseChannelName.toLowerCase()
       );
       
       if (!existingChannel) {
           try {
               const lobbyChannel = await guild.channels.create({
                   name: baseChannelName,
                   type: ChannelType.GuildVoice,
                   permissionOverwrites: [
                       {
                           id: guild.id,
                           allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                       },
                       {
                           id: challengerTeam.roleId,
                           allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                       },
                       {
                           id: targetTeam.roleId,
                           allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                       }
                   ]
               });
               
               console.log(`Canal de lobby criado: ${lobbyChannel.name} (${lobbyChannel.id})`);
               return lobbyChannel;
           } catch (error) {
               console.error(`Erro ao criar canal de lobby ${baseChannelName}:`, error);
               continue;
           }
       }
   }
   
   throw new Error('Não foi possível criar canal de lobby - muitos canais existem');
}

async function safeReply(interaction, content) {
   try {
       if (interaction.replied || interaction.deferred) {
           return await interaction.followUp(content);
       } else {
           return await interaction.reply(content);
       }
   } catch (error) {
       console.error('Erro ao responder interação:', error);
       try {
           if (!interaction.replied && !interaction.deferred) {
               return await interaction.reply({ content: 'Erro ao processar a solicitação.', flags: 64 });
           }
       } catch (fallbackError) {
           console.error('Erro no fallback de resposta:', fallbackError);
       }
   }
}

async function safeDelete(message) {
   try {
       if (message && message.deletable) {
           await message.delete();
           console.log('Mensagem deletada com sucesso');
       }
   } catch (error) {
       console.error('Erro ao deletar mensagem:', error);
   }
}

loadData();

module.exports = {
   name: Events.InteractionCreate,
   execute: async (interaction) => {
       loadData();

       if (interaction.isButton()) {
           console.log('Button clicked:', interaction.customId);

           if (interaction.customId === 'criar_time') {
               const userHasTeam = Object.values(teams).find(team => {
                   if (team.leaders && Array.isArray(team.leaders)) {
                       return team.leaders.includes(interaction.user.id);
                   }
                   if (team.leader) {
                       return team.leader === interaction.user.id;
                   }
                   return false;
               });

               if (userHasTeam) {
                   return await safeReply(interaction, { content: 'Você já é líder de um time!', flags: 64 });
               }

               const modal = new ModalBuilder()
                   .setCustomId('modal_criar_time')
                   .setTitle('Criar Time Free Fire');

               const nomeInput = new TextInputBuilder()
                   .setCustomId('nome_time')
                   .setLabel('Nome do Time')
                   .setStyle(TextInputStyle.Short)
                   .setRequired(true)
                   .setMaxLength(32);

               const corInput = new TextInputBuilder()
                   .setCustomId('cor_time')
                   .setLabel('Cor RGB (ex: 255,0,0)')
                   .setStyle(TextInputStyle.Short)
                   .setRequired(true)
                   .setPlaceholder('255,0,0');

               const firstActionRow = new ActionRowBuilder().addComponents(nomeInput);
               const secondActionRow = new ActionRowBuilder().addComponents(corInput);

               modal.addComponents(firstActionRow, secondActionRow);

               try {
                   await interaction.showModal(modal);
               } catch (error) {
                   console.error('Erro ao mostrar modal:', error);
                   await safeReply(interaction, { content: 'Erro ao abrir formulário de criação de time.', flags: 64 });
               }
           }

           if (interaction.customId.startsWith('aceitar_desafio_')) {
               const parts = interaction.customId.split('_');
               const challengerTeamId = parts[2];
               const targetTeamId = parts[3];
               
               const challengerTeam = teams[challengerTeamId];
               const targetTeam = teams[targetTeamId];

               if (!challengerTeam || !targetTeam) {
                   await safeDelete(interaction.message);
                   return await safeReply(interaction, { content: 'Times não encontrados!', flags: 64 });
               }

               if (isTeamInMatch(challengerTeamId)) {
                   await safeDelete(interaction.message);
                   return await safeReply(interaction, { content: 'O time desafiante já está em uma partida!', flags: 64 });
               }

               if (isTeamInMatch(targetTeamId)) {
                   await safeDelete(interaction.message);
                   return await safeReply(interaction, { content: 'Seu time já está em uma partida!', flags: 64 });
               }

               const isTargetLeader = (targetTeam.leaders && targetTeam.leaders.includes(interaction.user.id)) || 
                                    (targetTeam.leader === interaction.user.id);
               
               if (!isTargetLeader) {
                   return await safeReply(interaction, { content: 'Apenas líderes do time desafiado podem aceitar desafios!', flags: 64 });
               }

               try {
                   await interaction.deferReply({ flags: 64 });
                   await safeDelete(interaction.message);
               } catch (error) {
                   console.error('Erro ao defer reply:', error);
               }

               const matchId = Date.now().toString();
               matches[matchId] = {
                   id: matchId,
                   team1: challengerTeamId,
                   team2: targetTeamId,
                   status: 'preparando',
                   channels: {},
                   createdAt: new Date().toISOString()
               };

               const guild = interaction.guild;
               
               try {
                   const lobbyChannel = await createLobbyChannel(guild, challengerTeam, targetTeam);
                   
                   const categoryName = `Partida ${challengerTeam.name} vs ${targetTeam.name}`;
                   const category = await guild.channels.create({
                       name: categoryName,
                       type: ChannelType.GuildCategory
                   });

                   const voiceChannel1 = await guild.channels.create({
                       name: `🔊 ${challengerTeam.name}`,
                       type: ChannelType.GuildVoice,
                       parent: category.id,
                       permissionOverwrites: [
                          {
                              id: guild.id,
                              deny: [PermissionFlagsBits.ViewChannel]
                          },
                          {
                              id: challengerTeam.roleId,
                              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                          }
                      ]
                  });

                  const voiceChannel2 = await guild.channels.create({
                      name: `🔊 ${targetTeam.name}`,
                      type: ChannelType.GuildVoice,
                      parent: category.id,
                      permissionOverwrites: [
                          {
                              id: guild.id,
                              deny: [PermissionFlagsBits.ViewChannel]
                          },
                          {
                              id: targetTeam.roleId,
                              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                          }
                      ]
                  });

                  const textChannel1 = await guild.channels.create({
                      name: `💬-${challengerTeam.name.toLowerCase()}`,
                      type: ChannelType.GuildText,
                      parent: category.id,
                      permissionOverwrites: [
                          {
                              id: guild.id,
                              deny: [PermissionFlagsBits.ViewChannel]
                          },
                          {
                              id: challengerTeam.roleId,
                              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                          }
                      ]
                  });

                  const textChannel2 = await guild.channels.create({
                      name: `💬-${targetTeam.name.toLowerCase()}`,
                      type: ChannelType.GuildText,
                      parent: category.id,
                      permissionOverwrites: [
                          {
                              id: guild.id,
                              deny: [PermissionFlagsBits.ViewChannel]
                          },
                          {
                              id: targetTeam.roleId,
                              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                          }
                      ]
                  });

                  const generalChannel = await guild.channels.create({
                      name: '⚔️-geral-partida',
                      type: ChannelType.GuildText,
                      parent: category.id,
                      permissionOverwrites: [
                          {
                              id: guild.id,
                              deny: [PermissionFlagsBits.ViewChannel]
                          },
                          {
                              id: challengerTeam.roleId,
                              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                          },
                          {
                              id: targetTeam.roleId,
                              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                          }
                      ]
                  });

                  matches[matchId].channels = {
                      category: category.id,
                      voice1: voiceChannel1.id,
                      voice2: voiceChannel2.id,
                      text1: textChannel1.id,
                      text2: textChannel2.id,
                      general: generalChannel.id
                  };

                  matches[matchId].lobbyChannelId = lobbyChannel.id;

                  const embed = new EmbedBuilder()
                      .setAuthor({ 
                          name: 'PARTIDA INICIADA!',
                          iconURL: guild.iconURL()
                      })
                      .setDescription(`**${challengerTeam.name}** ${challengerTeam.icon || ''} VS **${targetTeam.name}** ${targetTeam.icon || ''}\n\nTodos os jogadores devem entrar no canal <#${lobbyChannel.id}> para serem movidos automaticamente!\n\nUse \`,iniciar\` para mover os jogadores quando estiverem prontos.\n\n⏰ **ATENÇÃO:** A partida será cancelada automaticamente em 2 minutos se não for iniciada!`)
                      .setColor('#00FF00')
                      .setFooter({ 
                          text: 'Partida criada - Entrem no lobby!'
                      });

                  await generalChannel.send({ embeds: [embed] });
                  
                  matches[matchId].status = 'aguardando_jogadores';
                  saveData();

                  console.log(`Partida ${matchId} criada, iniciando monitoramento`);
                  
                  if (interaction.client.matchMonitor) {
                      interaction.client.matchMonitor.startMonitoringMatch(matchId);
                  }

                  const successEmbed = new EmbedBuilder()
                      .setAuthor({ 
                          name: 'Desafio Aceito!',
                          iconURL: interaction.user.avatarURL()
                      })
                      .setDescription(`${interaction.user} aceitou o desafio!\n\n**Partida criada:**\n${challengerTeam.icon} **${challengerTeam.name}** VS **${targetTeam.name}** ${targetTeam.icon}\n\n🎮 **Canal de lobby:** <#${lobbyChannel.id}>\n⚔️ **Canal da partida:** <#${generalChannel.id}>`)
                      .setColor('#00FF00')
                      .setFooter({ 
                          text: 'Partida criada com sucesso!'
                      });

                  try {
                      await interaction.editReply({ embeds: [successEmbed] });
                  } catch (error) {
                      console.error('Erro ao editar reply:', error);
                      try {
                          const channel = interaction.channel;
                          if (channel) {
                              await channel.send({ embeds: [successEmbed] });
                          }
                      } catch (channelError) {
                          console.error('Erro ao enviar mensagem no canal:', channelError);
                      }
                  }

              } catch (error) {
                  console.error('Erro ao criar canais:', error);
                  try {
                      await interaction.editReply({ content: 'Erro ao criar canais da partida!' });
                  } catch (editError) {
                      console.error('Erro ao editar reply com erro:', editError);
                  }
              }
          }

          if (interaction.customId.startsWith('recusar_desafio_')) {
              const parts = interaction.customId.split('_');
              const challengerTeamId = parts[2];
              const targetTeamId = parts[3];
              
              const challengerTeam = teams[challengerTeamId];
              const targetTeam = teams[targetTeamId];

              const isTargetLeader = (targetTeam?.leaders && targetTeam.leaders.includes(interaction.user.id)) || 
                                    (targetTeam?.leader === interaction.user.id);
              
              if (!isTargetLeader) {
                  return await safeReply(interaction, { content: 'Apenas líderes do time desafiado podem recusar desafios!', flags: 64 });
              }

              const embed = new EmbedBuilder()
                  .setAuthor({ 
                      name: 'Desafio Recusado',
                      iconURL: interaction.user.avatarURL()
                  })
                  .setDescription(`${interaction.user} recusou o desafio do time **${challengerTeam?.name}** ${challengerTeam?.icon || ''}!`)
                  .setColor('#FF0000')
                  .setFooter({ 
                      text: 'Desafio recusado'
                  });

              await safeDelete(interaction.message);
              await safeReply(interaction, { embeds: [embed] });
          }

          if (interaction.customId.startsWith('aceitar_convite_')) {
              console.log('Aceitar convite clicked');
              console.log('Full customId:', interaction.customId);
              
              const fullCustomId = interaction.customId;
              const inviteId = fullCustomId.replace('aceitar_convite_', '');
              console.log('Extracted inviteId:', inviteId);
              console.log('Available invites:', Object.keys(invites));
              
              const invite = invites[inviteId];
              console.log('Found invite:', invite);
              
              if (!invite || invite.status !== 'pendente') {
                  console.log('Invite not found or not pending');
                  await safeDelete(interaction.message);
                  return await safeReply(interaction, { content: 'Convite não encontrado ou já processado!', flags: 64 });
              }

              if (invite.userId !== interaction.user.id) {
                  console.log('Wrong user trying to accept');
                  return await safeReply(interaction, { content: 'Este convite não é para você!', flags: 64 });
              }

              const team = teams[invite.teamId];
              if (!team) {
                  console.log('Team not found');
                  invite.status = 'expirado';
                  saveData();
                  await safeDelete(interaction.message);
                  return await safeReply(interaction, { content: 'Time não encontrado! O convite expirou.', flags: 64 });
              }

              const userInOtherTeam = Object.values(teams).some(t => {
                  if (!t.members || !Array.isArray(t.members)) return false;
                  return t.members.includes(interaction.user.id);
              });

              if (userInOtherTeam) {
                  invite.status = 'recusado';
                  saveData();
                  await safeDelete(interaction.message);
                  return await safeReply(interaction, { content: 'Você já está em outro time!', flags: 64 });
              }

              try {
                  const guild = interaction.guild;
                  const member = await guild.members.fetch(interaction.user.id);
                  
                  if (!team.members) team.members = [];
                  team.members.push(interaction.user.id);
                  await member.roles.add(team.roleId);
                  
                  if (team.prefix) {
                      const currentNick = member.nickname || member.user.username;
                      const newNickname = `${team.prefix}${currentNick}`;
                      if (newNickname.length <= 32) {
                          try {
                              await member.setNickname(newNickname);
                          } catch (error) {
                              console.log('Erro ao definir nickname:', error.message);
                          }
                      }
                  }
                  
                  invite.status = 'aceito';
                  saveData();

                  const embed = new EmbedBuilder()
                      .setAuthor({ 
                          name: 'Convite Aceito!',
                          iconURL: interaction.user.avatarURL()
                      })
                      .setDescription(`${interaction.user} foi adicionado ao time **${team.name}** ${team.icon || ''}!`)
                      .setColor(team.color)
                      .setFooter({ 
                          text: 'Bem-vindo ao time!'
                      });

                  await safeDelete(interaction.message);
                  await safeReply(interaction, { embeds: [embed] });

                  try {
                      const inviter = await interaction.client.users.fetch(invite.invitedBy);
                      const channel = interaction.channel;
                      await channel.send(`📩 ${inviter}, ${interaction.user.username} aceitou seu convite para o time **${team.name}** ${team.icon || ''}!`);
                  } catch (error) {
                      console.log('Erro ao notificar quem convidou');
                  }

              } catch (error) {
                  console.error('Error processing invite:', error);
                  await safeReply(interaction, { content: 'Erro ao processar convite!', flags: 64 });
              }
          }

          if (interaction.customId.startsWith('recusar_convite_')) {
              console.log('Recusar convite clicked');
              
              const fullCustomId = interaction.customId;
              const inviteId = fullCustomId.replace('recusar_convite_', '');
              const invite = invites[inviteId];
             
             if (!invite || invite.status !== 'pendente') {
                 await safeDelete(interaction.message);
                 return await safeReply(interaction, { content: 'Convite não encontrado ou já processado!', flags: 64 });
             }

             if (invite.userId !== interaction.user.id) {
                 return await safeReply(interaction, { content: 'Este convite não é para você!', flags: 64 });
            }

            const team = teams[invite.teamId];
            invite.status = 'recusado';
            saveData();

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'Convite Recusado',
                    iconURL: interaction.user.avatarURL()
                })
                .setDescription(`${interaction.user} recusou o convite para o time **${team?.name || 'Time'}**.`)
                .setColor('#FF0000')
                .setFooter({ 
                    text: 'Convite recusado'
                });

            await safeDelete(interaction.message);
            await safeReply(interaction, { embeds: [embed] });

            try {
                const inviter = await interaction.client.users.fetch(invite.invitedBy);
                const channel = interaction.channel;
                await channel.send(`📩 ${inviter}, ${interaction.user.username} recusou seu convite para o time **${team?.name || 'Time'}**.`);
            } catch (error) {
                console.log('Erro ao notificar quem convidou');
            }
        }

        if (interaction.customId.startsWith('finalizar_sim_') || interaction.customId.startsWith('finalizar_nao_')) {
            const parts = interaction.customId.split('_');
            const vote = parts[1];
            const matchId = parts[2];
            
            const match = matches[matchId];
            if (!match || !match.finishVote) {
                return await safeReply(interaction, { content: 'Votação não encontrada!', flags: 64 });
            }

            if (!match.players || !match.players.team1 || !match.players.team2) {
                return await safeReply(interaction, { content: 'Dados da partida incompletos!', flags: 64 });
            }

            const allPlayers = [...match.players.team1, ...match.players.team2];
            if (!allPlayers.includes(interaction.user.id)) {
                return await safeReply(interaction, { content: 'Apenas jogadores da partida podem votar!', flags: 64 });
            }

            if (match.finishVote.yes.includes(interaction.user.id) || match.finishVote.no.includes(interaction.user.id)) {
                return await safeReply(interaction, { content: 'Você já votou!', flags: 64 });
            }

            if (vote === 'sim') {
                match.finishVote.yes.push(interaction.user.id);
            } else {
                match.finishVote.no.push(interaction.user.id);
            }

            saveData();
            await safeReply(interaction, { content: `Voto registrado!`, flags: 64 });
        }

        if (interaction.customId.startsWith('vencedor_')) {
            const parts = interaction.customId.split('_');
            const winnerTeamId = parts[1];
            const matchId = parts[2];
            
            const match = matches[matchId];
            if (!match || !match.winnerVote) {
                return await safeReply(interaction, { content: 'Votação não encontrada!', flags: 64 });
            }

            if (!match.players || !match.players.team1 || !match.players.team2) {
                return await safeReply(interaction, { content: 'Dados da partida incompletos!', flags: 64 });
            }

            const allPlayers = [...match.players.team1, ...match.players.team2];
            if (!allPlayers.includes(interaction.user.id)) {
                return await safeReply(interaction, { content: 'Apenas jogadores da partida podem votar!', flags: 64 });
            }

            if (match.winnerVote.team1Votes.includes(interaction.user.id) || match.winnerVote.team2Votes.includes(interaction.user.id)) {
                return await safeReply(interaction, { content: 'Você já votou!', flags: 64 });
            }

            if (winnerTeamId === match.team1) {
                match.winnerVote.team1Votes.push(interaction.user.id);
            } else {
                match.winnerVote.team2Votes.push(interaction.user.id);
            }

            saveData();
            await safeReply(interaction, { content: `Voto registrado!`, flags: 64 });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_criar_time') {
            const nome = interaction.fields.getTextInputValue('nome_time');
            const corRGB = interaction.fields.getTextInputValue('cor_time');

            const rgbArray = corRGB.split(',').map(num => parseInt(num.trim()));
            if (rgbArray.length !== 3 || rgbArray.some(num => isNaN(num) || num < 0 || num > 255)) {
                return await safeReply(interaction, { content: 'Formato de cor inválido! Use: 255,0,0', flags: 64 });
            }

            const hexColor = `#${rgbArray.map(num => num.toString(16).padStart(2, '0')).join('')}`;

            try {
                const role = await interaction.guild.roles.create({
                    name: nome,
                    color: hexColor,
                    reason: 'Criação de time Free Fire'
                });

                const teamId = Date.now().toString();
                const roleIcon = role.iconURL();
                
                teams[teamId] = {
                    id: teamId,
                    name: nome,
                    color: hexColor,
                    icon: roleIcon || '',
                    creator: interaction.user.id,
                    leaders: [interaction.user.id],
                    members: [interaction.user.id],
                    roleId: role.id,
                    createdAt: new Date().toISOString(),
                    stats: {
                        victories: 0,
                        defeats: 0,
                        matches: 0
                    }
                };

                await interaction.member.roles.add(role);
                saveData();

                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: `Time ${nome} criado!`,
                        iconURL: interaction.user.avatarURL()
                    })
                    .setDescription(`Líder: ${interaction.user}\nCor: ${hexColor}\nMembros: 1`)
                    .setColor(hexColor)
                    .setFooter({ 
                        text: 'Sistema de Times Free Fire'
                    });

                await safeReply(interaction, { embeds: [embed], flags: 64 });
            } catch (error) {
                console.error(error);
                await safeReply(interaction, { content: 'Erro ao criar o time!', flags: 64 });
            }
        }
    }
}
};