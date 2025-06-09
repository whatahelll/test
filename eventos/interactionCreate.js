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

// Carregar dados na inicialização
loadData();

module.exports = {
    name: Events.InteractionCreate,
    execute: async (interaction) => {
        // Recarregar dados a cada interação para garantir sincronização
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
                    return interaction.reply({ content: 'Você já é líder de um time!', flags: 64 });
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

                const iconeInput = new TextInputBuilder()
                    .setCustomId('icone_time')
                    .setLabel('Emoji do Time')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(2);

                const firstActionRow = new ActionRowBuilder().addComponents(nomeInput);
                const secondActionRow = new ActionRowBuilder().addComponents(corInput);
                const thirdActionRow = new ActionRowBuilder().addComponents(iconeInput);

                modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

                await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('desafiar_')) {
                const targetTeamId = interaction.customId.split('_')[1];
                const challengerTeam = Object.values(teams).find(team => {
                    if (team.leaders && Array.isArray(team.leaders)) {
                        return team.leaders.includes(interaction.user.id);
                    }
                    if (team.leader) {
                        return team.leader === interaction.user.id;
                    }
                    return false;
                });
                
                if (!challengerTeam) {
                    return interaction.reply({ content: 'Você não é líder de nenhum time!', flags: 64 });
                }

                const targetTeam = teams[targetTeamId];
                if (!targetTeam) {
                    return interaction.reply({ content: 'Time não encontrado!', flags: 64 });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔥 Desafio Enviado! 🔥')
                    .setDescription(`O time **${challengerTeam.name}** ${challengerTeam.icon} desafiou **${targetTeam.name}** ${targetTeam.icon}!\n\nLíder do **${targetTeam.name}**, aceite ou recuse o desafio:`)
                    .setColor(parseInt(challengerTeam.color.replace('#', ''), 16));

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`aceitar_desafio_${challengerTeam.id}_${targetTeamId}`)
                            .setLabel('Aceitar Desafio')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('⚔️'),
                        new ButtonBuilder()
                            .setCustomId(`recusar_desafio_${challengerTeam.id}_${targetTeamId}`)
                            .setLabel('Recusar Desafio')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                    );

                await interaction.reply({ embeds: [embed], components: [row] });
            }

            if (interaction.customId.startsWith('aceitar_desafio_')) {
                const parts = interaction.customId.split('_');
                const challengerTeamId = parts[2];
                const targetTeamId = parts[3];
                
                const challengerTeam = teams[challengerTeamId];
                const targetTeam = teams[targetTeamId];

                if (!challengerTeam || !targetTeam) {
                    return interaction.reply({ content: 'Times não encontrados!', flags: 64 });
                }

                const targetLeaderId = targetTeam.leaders && Array.isArray(targetTeam.leaders) 
                    ? targetTeam.leaders[0] 
                    : targetTeam.leader;
                
                if (targetLeaderId !== interaction.user.id) {
                    return interaction.reply({ content: 'Apenas o líder do time pode aceitar desafios!', flags: 64 });
                }

                const matchId = Date.now().toString();
                matches[matchId] = {
                    id: matchId,
                    team1: challengerTeamId,
                    team2: targetTeamId,
                    status: 'preparando',
                    channels: {}
                };

                const guild = interaction.guild;
                
                try {
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

                    const embed = new EmbedBuilder()
                        .setTitle('🔥 PARTIDA INICIADA! 🔥')
                        .setDescription(`**${challengerTeam.name}** ${challengerTeam.icon} VS **${targetTeam.name}** ${targetTeam.icon}\n\nTodos os jogadores devem entrar no canal <#1367543346469404756> para serem movidos automaticamente!\n\nUse \`,iniciar\` para mover os jogadores quando estiverem prontos.`)
                        .setColor('#00FF00');

                    await generalChannel.send({ embeds: [embed] });
                    
                    matches[matchId].status = 'aguardando_jogadores';
                    saveData();

                    interaction.reply({ content: '✅ Desafio aceito! Canais criados com sucesso!', flags: 64 });

                } catch (error) {
                    console.error('Erro ao criar canais:', error);
                    interaction.reply({ content: 'Erro ao criar canais da partida!', flags: 64 });
                }
            }

            if (interaction.customId.startsWith('recusar_desafio_')) {
                const parts = interaction.customId.split('_');
                const challengerTeamId = parts[2];
                const targetTeamId = parts[3];
                
                const challengerTeam = teams[challengerTeamId];
                const targetTeam = teams[targetTeamId];

                const targetLeaderId = targetTeam?.leaders && Array.isArray(targetTeam.leaders) 
                    ? targetTeam.leaders[0] 
                    : targetTeam?.leader;
                
                if (targetLeaderId !== interaction.user.id) {
                    return interaction.reply({ content: 'Apenas o líder do time pode recusar desafios!', flags: 64 });
                }

                interaction.reply({ content: `❌ ${interaction.user} recusou o desafio do time **${challengerTeam?.name}**!` });
            }

            // Aceitar convite para time
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
                    return interaction.reply({ content: 'Convite não encontrado ou já processado!', flags: 64 });
                }

                if (invite.userId !== interaction.user.id) {
                    console.log('Wrong user trying to accept');
                    return interaction.reply({ content: 'Este convite não é para você!', flags: 64 });
                }

                const team = teams[invite.teamId];
                if (!team) {
                    console.log('Team not found');
                    invite.status = 'expirado';
                    saveData();
                    return interaction.reply({ content: 'Time não encontrado! O convite expirou.', flags: 64 });
                }

                // Verificar se o usuário já está em outro time
                const userInOtherTeam = Object.values(teams).some(t => {
                    if (!t.members || !Array.isArray(t.members)) return false;
                    return t.members.includes(interaction.user.id);
                });

                if (userInOtherTeam) {
                    invite.status = 'recusado';
                    saveData();
                    return interaction.reply({ content: 'Você já está em outro time!', flags: 64 });
                }

                try {
                    const guild = interaction.guild;
                    const member = await guild.members.fetch(interaction.user.id);
                    
                    if (!team.members) team.members = [];
                    team.members.push(interaction.user.id);
                    await member.roles.add(team.roleId);
                    
                    invite.status = 'aceito';
                    saveData();

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Convite Aceito!')
                        .setDescription(`${interaction.user} foi adicionado ao time **${team.name}** ${team.icon}!`)
                        .setColor(team.color);

                    await interaction.reply({ embeds: [embed] });

                    // Notificar quem convidou
                    try {
                        const inviter = await interaction.client.users.fetch(invite.invitedBy);
                        const channel = interaction.channel;
                        await channel.send(`📩 ${inviter}, ${interaction.user.username} aceitou seu convite para o time **${team.name}** ${team.icon}!`);
                    } catch (error) {
                        console.log('Erro ao notificar quem convidou');
                    }

                } catch (error) {
                    console.error('Error processing invite:', error);
                    interaction.reply({ content: 'Erro ao processar convite!', flags: 64 });
                }
            }

            // Recusar convite para time
            if (interaction.customId.startsWith('recusar_convite_')) {
                console.log('Recusar convite clicked');
                
                const fullCustomId = interaction.customId;
                const inviteId = fullCustomId.replace('recusar_convite_', '');
                console.log('Extracted inviteId:', inviteId);
                
                const invite = invites[inviteId];
                
                if (!invite || invite.status !== 'pendente') {
                    return interaction.reply({ content: 'Convite não encontrado ou já processado!', flags: 64 });
                }

                if (invite.userId !== interaction.user.id) {
                    return interaction.reply({ content: 'Este convite não é para você!', flags: 64 });
                }

                const team = teams[invite.teamId];
                invite.status = 'recusado';
                saveData();

                const embed = new EmbedBuilder()
                    .setTitle('❌ Convite Recusado')
                    .setDescription(`${interaction.user} recusou o convite para o time **${team?.name || 'Time'}**.`)
                    .setColor('#FF0000');

                await interaction.reply({ embeds: [embed] });

                // Notificar quem convidou
                try {
                    const inviter = await interaction.client.users.fetch(invite.invitedBy);
                    const channel = interaction.channel;
                    await channel.send(`📩 ${inviter}, ${interaction.user.username} recusou seu convite para o time **${team?.name || 'Time'}**.`);
                } catch (error) {
                    console.log('Erro ao notificar quem convidou');
                }
            }

            // Votação para finalizar partida
            if (interaction.customId.startsWith('finalizar_sim_') || interaction.customId.startsWith('finalizar_nao_')) {
                const parts = interaction.customId.split('_');
                const vote = parts[1];
                const matchId = parts[2];
                
                const match = matches[matchId];
                if (!match || !match.finishVote) {
                    return interaction.reply({ content: 'Votação não encontrada!', flags: 64 });
                }

                if (!match.players || !match.players.team1 || !match.players.team2) {
                    return interaction.reply({ content: 'Dados da partida incompletos!', flags: 64 });
                }

                const allPlayers = [...match.players.team1, ...match.players.team2];
                if (!allPlayers.includes(interaction.user.id)) {
                    return interaction.reply({ content: 'Apenas jogadores da partida podem votar!', flags: 64 });
                }

                if (match.finishVote.yes.includes(interaction.user.id) || match.finishVote.no.includes(interaction.user.id)) {
                    return interaction.reply({ content: 'Você já votou!', flags: 64 });
                }

                if (vote === 'sim') {
                    match.finishVote.yes.push(interaction.user.id);
                } else {
                    match.finishVote.no.push(interaction.user.id);
                }

                const totalVotes = match.finishVote.yes.length + match.finishVote.no.length;
                
                if (match.finishVote.yes.length >= match.finishVote.requiredVotes) {
                    // Iniciar votação do vencedor
                    const team1 = teams[match.team1];
                    const team2 = teams[match.team2];

                    const embed = new EmbedBuilder()
                        .setTitle('🏆 Qual time ganhou?')
                        .setDescription(`**${team1.name}** ${team1.icon} VS **${team2.name}** ${team2.icon}`)
                        .setColor('#FFD700');

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`vencedor_${match.team1}_${matchId}`)
                                .setLabel(`${team1.name} ${team1.icon}`)
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`vencedor_${match.team2}_${matchId}`)
                                .setLabel(`${team2.name} ${team2.icon}`)
                                .setStyle(ButtonStyle.Primary)
                        );

                    const channel = interaction.client.channels.cache.get(match.channels.general);
                    if (channel) {
                        const voteMessage = await channel.send({ embeds: [embed], components: [row] });

                        match.winnerVote = {
                            messageId: voteMessage.id,
                            team1Votes: [],
                            team2Votes: [],
                            requiredVotes: Math.ceil(allPlayers.length / 2)
                        };
                        
                        match.status = 'votando_vencedor';
                        saveData();

                        interaction.reply({ content: 'Partida finalizada! Votação do vencedor iniciada.', flags: 64 });
                    } else {
                        interaction.reply({ content: 'Erro: Canal da partida não encontrado!', flags: 64 });
                    }
                } else {
                    saveData();
                    interaction.reply({ content: `Voto registrado! (${match.finishVote.yes.length}/${match.finishVote.requiredVotes} votos para finalizar)`, flags: 64 });
                }
            }

            // Votação do vencedor
            if (interaction.customId.startsWith('vencedor_')) {
                const parts = interaction.customId.split('_');
                const winnerTeamId = parts[1];
                const matchId = parts[2];
                
                const match = matches[matchId];
                if (!match || !match.winnerVote) {
                    return interaction.reply({ content: 'Votação não encontrada!', flags: 64 });
                }

                if (!match.players || !match.players.team1 || !match.players.team2) {
                    return interaction.reply({ content: 'Dados da partida incompletos!', flags: 64 });
                }

                const allPlayers = [...match.players.team1, ...match.players.team2];
                if (!allPlayers.includes(interaction.user.id)) {
                    return interaction.reply({ content: 'Apenas jogadores da partida podem votar!', flags: 64 });
                }

                if (match.winnerVote.team1Votes.includes(interaction.user.id) || match.winnerVote.team2Votes.includes(interaction.user.id)) {
                    return interaction.reply({ content: 'Você já votou!', flags: 64 });
                }

                if (winnerTeamId === match.team1) {
                    match.winnerVote.team1Votes.push(interaction.user.id);
                } else {
                    match.winnerVote.team2Votes.push(interaction.user.id);
                }

                const team1Votes = match.winnerVote.team1Votes.length;
                const team2Votes = match.winnerVote.team2Votes.length;

                if (team1Votes >= match.winnerVote.requiredVotes || team2Votes >= match.winnerVote.requiredVotes) {
                    // Determinar vencedor e atualizar estatísticas
                    const finalWinnerTeamId = team1Votes > team2Votes ? match.team1 : match.team2;
                    const loserTeamId = finalWinnerTeamId === match.team1 ? match.team2 : match.team1;

                    const winnerTeam = teams[finalWinnerTeamId];
                    const loserTeam = teams[loserTeamId];

                    if (winnerTeam && loserTeam) {
                        winnerTeam.stats.victories++;
                        winnerTeam.stats.matches++;
                        loserTeam.stats.defeats++;
                        loserTeam.stats.matches++;

                        // Deletar canais da partida
                        try {
                            const guild = interaction.guild;
                            const category = guild.channels.cache.get(match.channels.category);
                            if (category) {
                                for (const child of category.children.cache.values()) {
                                    await child.delete();
                                }
                                await category.delete();
                            }
                        } catch (error) {
                            console.log('Erro ao deletar canais');
                        }

                        delete matches[matchId];
                        saveData();

                        const embed = new EmbedBuilder()
                            .setTitle('🎉 PARTIDA FINALIZADA! 🎉')
                            .setDescription(`**${winnerTeam.name}** ${winnerTeam.icon} VENCEU!\n\n**Estatísticas atualizadas:**\n${winnerTeam.icon} **${winnerTeam.name}**: ${winnerTeam.stats.victories}V - ${winnerTeam.stats.defeats}D\n${loserTeam.icon} **${loserTeam.name}**: ${loserTeam.stats.victories}V - ${loserTeam.stats.defeats}D`)
                            .setColor('#00FF00');

                        interaction.reply({ embeds: [embed] });
                    }
                } else {
                    saveData();
                    interaction.reply({ content: `Voto registrado! Time 1: ${team1Votes} | Time 2: ${team2Votes} (${match.winnerVote.requiredVotes} votos necessários)`, flags: 64 });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_criar_time') {
                const nome = interaction.fields.getTextInputValue('nome_time');
                const corRGB = interaction.fields.getTextInputValue('cor_time');
                const icone = interaction.fields.getTextInputValue('icone_time');

                const rgbArray = corRGB.split(',').map(num => parseInt(num.trim()));
                if (rgbArray.length !== 3 || rgbArray.some(num => isNaN(num) || num < 0 || num > 255)) {
                    return interaction.reply({ content: 'Formato de cor inválido! Use: 255,0,0', flags: 64 });
               }

               const hexColor = `#${rgbArray.map(num => num.toString(16).padStart(2, '0')).join('')}`;

               try {
                   const role = await interaction.guild.roles.create({
                       name: nome,
                       color: hexColor,
                       reason: 'Criação de time Free Fire'
                   });

                   const teamId = Date.now().toString();
                   teams[teamId] = {
                       id: teamId,
                       name: nome,
                       color: hexColor,
                       icon: icone,
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
                       .setTitle(`${icone} Time ${nome} criado!`)
                       .setDescription(`Líder: ${interaction.user}\nCor: ${hexColor}\nMembros: 1`)
                       .setColor(hexColor);

                   interaction.reply({ embeds: [embed], flags: 64 });
               } catch (error) {
                   console.error(error);
                   interaction.reply({ content: 'Erro ao criar o time!', flags: 64 });
               }
           }
       }
   }
};