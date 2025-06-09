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

async function cancelMatchAfterTimeout(matchId, client) {
    console.log(`Iniciando timeout para partida ${matchId}`);
    
    const checkInterval = setInterval(async () => {
        loadData();
        const match = matches[matchId];
        
        if (!match) {
            console.log(`Partida ${matchId} não encontrada, cancelando verificação`);
            clearInterval(checkInterval);
            return;
        }

        if (match.status !== 'aguardando_jogadores') {
            console.log(`Partida ${matchId} mudou de status para ${match.status}, cancelando verificação`);
            clearInterval(checkInterval);
            return;
        }

        console.log(`Verificando partida ${matchId}...`);
        
        try {
            const guild = client.guilds.cache.get('1336151112653869147');
            if (!guild) {
                console.log('Guild não encontrada');
                clearInterval(checkInterval);
                return;
            }

            const lobbyChannel = guild.channels.cache.get('1367543346469404756');
            if (!lobbyChannel) {
                console.log('Canal de lobby não encontrado');
                clearInterval(checkInterval);
                return;
            }

            const team1 = teams[match.team1];
            const team2 = teams[match.team2];

            if (!team1 || !team2) {
                console.log('Times não encontrados');
                clearInterval(checkInterval);
                return;
            }

            const membersInLobby = lobbyChannel.members;
            const team1Members = membersInLobby.filter(member => member.roles.cache.has(team1.roleId));
            const team2Members = membersInLobby.filter(member => member.roles.cache.has(team2.roleId));

            console.log(`Jogadores no lobby - Team1: ${team1Members.size}, Team2: ${team2Members.size}`);

            const createdTime = new Date(match.createdAt).getTime();
            const currentTime = new Date().getTime();
            const timeElapsed = currentTime - createdTime;

            if (timeElapsed >= 120000) {
                console.log(`2 minutos se passaram para partida ${matchId}, cancelando...`);
                
                const embed = new EmbedBuilder()
                    .setTitle('⏰ PARTIDA CANCELADA POR TIMEOUT')
                    .setDescription(`A partida entre **${team1.name}** ${team1.icon} e **${team2.name}** ${team2.icon} foi cancelada automaticamente.\n\n**Motivo:** Os jogadores não entraram no lobby dentro de 2 minutos.`)
                    .setColor('#FF0000');

                const generalChannel = guild.channels.cache.get(match.channels?.general);
                if (generalChannel) {
                    await generalChannel.send({ embeds: [embed] });
                }

                const announcementChannel = guild.channels.cache.get('1381722215812169910');
                if (announcementChannel) {
                    await announcementChannel.send({ embeds: [embed] });
                }

                const category = guild.channels.cache.get(match.channels?.category);
                if (category) {
                    for (const child of category.children.cache.values()) {
                        try {
                            await child.delete();
                        } catch (error) {
                            console.log('Erro ao deletar canal:', error);
                        }
                    }
                    try {
                        await category.delete();
                    } catch (error) {
                        console.log('Erro ao deletar categoria:', error);
                    }
                }

                delete matches[matchId];
                saveData();

                console.log(`Partida ${matchId} cancelada por timeout`);
                clearInterval(checkInterval);
            }
        } catch (error) {
            console.error('Erro ao verificar partida:', error);
        }
    }, 10000);

    setTimeout(() => {
        clearInterval(checkInterval);
        console.log(`Timeout final para partida ${matchId}`);
    }, 130000);
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

                try {
                    await interaction.showModal(modal);
                } catch (error) {
                    console.error('Erro ao mostrar modal:', error);
                    await safeReply(interaction, { content: 'Erro ao abrir formulário de criação de time.', flags: 64 });
                }
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
                    return await safeReply(interaction, { content: 'Você não é líder de nenhum time!', flags: 64 });
                }

                if (isTeamInMatch(challengerTeam.id)) {
                    return await safeReply(interaction, { content: 'Seu time já está em uma partida! Finalize antes de desafiar outros times.', flags: 64 });
                }

                const targetTeam = teams[targetTeamId];
                if (!targetTeam) {
                    return await safeReply(interaction, { content: 'Time não encontrado!', flags: 64 });
                }

                if (isTeamInMatch(targetTeamId)) {
                    return await safeReply(interaction, { content: 'Este time já está em uma partida! Tente novamente mais tarde.', flags: 64 });
                }

                if (challengerTeam.id === targetTeamId) {
                    return await safeReply(interaction, { content: 'Você não pode desafiar seu próprio time!', flags: 64 });
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

                await safeReply(interaction, { embeds: [embed], components: [row] });
            }

            if (interaction.customId.startsWith('aceitar_desafio_')) {
                const parts = interaction.customId.split('_');
                const challengerTeamId = parts[2];
                const targetTeamId = parts[3];
                
                const challengerTeam = teams[challengerTeamId];
                const targetTeam = teams[targetTeamId];

                if (!challengerTeam || !targetTeam) {
                    return await safeReply(interaction, { content: 'Times não encontrados!', flags: 64 });
                }

                if (isTeamInMatch(challengerTeamId)) {
                    return await safeReply(interaction, { content: 'O time desafiante já está em uma partida!', flags: 64 });
                }

                if (isTeamInMatch(targetTeamId)) {
                    return await safeReply(interaction, { content: 'Seu time já está em uma partida!', flags: 64 });
                }

                const targetLeaderId = targetTeam.leaders && Array.isArray(targetTeam.leaders) 
                    ? targetTeam.leaders[0] 
                    : targetTeam.leader;
                
                if (targetLeaderId !== interaction.user.id) {
                    return await safeReply(interaction, { content: 'Apenas o líder do time pode aceitar desafios!', flags: 64 });
                }

                try {
                    await interaction.deferReply({ flags: 64 });
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
                        .setDescription(`**${challengerTeam.name}** ${challengerTeam.icon} VS **${targetTeam.name}** ${targetTeam.icon}\n\nTodos os jogadores devem entrar no canal <#1367543346469404756> para serem movidos automaticamente!\n\nUse \`,iniciar\` para mover os jogadores quando estiverem prontos.\n\n⏰ **ATENÇÃO:** A partida será cancelada automaticamente em 2 minutos se não for iniciada!`)
                        .setColor('#00FF00');

                    await generalChannel.send({ embeds: [embed] });
                    
                    matches[matchId].status = 'aguardando_jogadores';
                    saveData();

                    console.log(`Partida ${matchId} criada, iniciando sistema de timeout`);
                    cancelMatchAfterTimeout(matchId, interaction.client);

                    try {
                        await interaction.editReply({ content: '✅ Desafio aceito! Canais criados com sucesso!' });
                    } catch (error) {
                        console.error('Erro ao editar reply:', error);
                        try {
                            const channel = interaction.channel;
                            if (channel) {
                                await channel.send('✅ Desafio aceito! Canais criados com sucesso!');
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

                const targetLeaderId = targetTeam?.leaders && Array.isArray(targetTeam.leaders) 
                    ? targetTeam.leaders[0] 
                    : targetTeam?.leader;
                
                if (targetLeaderId !== interaction.user.id) {
                    return await safeReply(interaction, { content: 'Apenas o líder do time pode recusar desafios!', flags: 64 });
                }

                await safeReply(interaction, { content: `❌ ${interaction.user} recusou o desafio do time **${challengerTeam?.name}**!` });
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
                    return await safeReply(interaction, { content: 'Time não encontrado! O convite expirou.', flags: 64 });
                }

                const userInOtherTeam = Object.values(teams).some(t => {
                    if (!t.members || !Array.isArray(t.members)) return false;
                    return t.members.includes(interaction.user.id);
                });

                if (userInOtherTeam) {
                    invite.status = 'recusado';
                    saveData();
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
                        .setTitle('✅ Convite Aceito!')
                        .setDescription(`${interaction.user} foi adicionado ao time **${team.name}** ${team.icon}!`)
                        .setColor(team.color);

                    await safeReply(interaction, { embeds: [embed] });

                    try {
                        const inviter = await interaction.client.users.fetch(invite.invitedBy);
                        const channel = interaction.channel;
                        await channel.send(`📩 ${inviter}, ${interaction.user.username} aceitou seu convite para o time **${team.name}** ${team.icon}!`);
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
                console.log('Extracted inviteId:', inviteId);
                
                const invite = invites[inviteId];
                
                if (!invite || invite.status !== 'pendente') {
                    return await safeReply(interaction, { content: 'Convite não encontrado ou já processado!', flags: 64 });
                }

                if (invite.userId !== interaction.user.id) {
                    return await safeReply(interaction, { content: 'Este convite não é para você!', flags: 64 });
                }

                const team = teams[invite.teamId];
                invite.status = 'recusado';
                saveData();

                const embed = new EmbedBuilder()
                    .setTitle('❌ Convite Recusado')
                    .setDescription(`${interaction.user} recusou o convite para o time **${team?.name || 'Time'}**.`)
                    .setColor('#FF0000');

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
                const icone = interaction.fields.getTextInputValue('icone_time');

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

                   await safeReply(interaction, { embeds: [embed], flags: 64 });
               } catch (error) {
                   console.error(error);
                   await safeReply(interaction, { content: 'Erro ao criar o time!', flags: 64 });
               }
           }
       }
   }
};