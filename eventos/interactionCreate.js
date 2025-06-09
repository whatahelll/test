const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

let teams = {};
let matches = {};

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

function saveData() {
    if (!fs.existsSync('./dados')) fs.mkdirSync('./dados');
    fs.writeFileSync('./dados/times.json', JSON.stringify(teams, null, 2));
    fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));
}

module.exports = {
    name: Events.InteractionCreate,
    execute: async (interaction) => {
        if (interaction.isButton()) {
            if (interaction.customId === 'criar_time') {
                if (Object.values(teams).find(team => team.leader === interaction.user.id)) {
                    return interaction.reply({ content: 'Você já é líder de um time!', ephemeral: true });
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
                const challengerTeam = Object.values(teams).find(team => team.leader === interaction.user.id);
                
                if (!challengerTeam) {
                    return interaction.reply({ content: 'Você não é líder de nenhum time!', ephemeral: true });
                }

                const targetTeam = teams[targetTeamId];
                if (!targetTeam) {
                    return interaction.reply({ content: 'Time não encontrado!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔥 Desafio Recebido! 🔥')
                    .setDescription(`O time **${challengerTeam.name}** ${challengerTeam.icon} está desafiando **${targetTeam.name}** ${targetTeam.icon}!`)
                    .setColor(parseInt(challengerTeam.color.replace('#', ''), 16));

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`aceitar_${challengerTeam.id}_${targetTeamId}`)
                            .setLabel('Aceitar')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('recusar_desafio')
                            .setLabel('Recusar')
                            .setStyle(ButtonStyle.Danger)
                    );

                const targetLeader = await interaction.guild.members.fetch(targetTeam.leader);
                await targetLeader.send({ embeds: [embed], components: [row] });
                
                interaction.reply({ content: `Desafio enviado para o líder do time **${targetTeam.name}**!`, ephemeral: true });
            }

            if (interaction.customId.startsWith('aceitar_')) {
                const [, challengerTeamId, targetTeamId] = interaction.customId.split('_');
                const challengerTeam = teams[challengerTeamId];
                const targetTeam = teams[targetTeamId];

                if (targetTeam.leader !== interaction.user.id) {
                    return interaction.reply({ content: 'Apenas o líder do time pode aceitar desafios!', ephemeral: true });
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
                    .setDescription(`**${challengerTeam.name}** ${challengerTeam.icon} VS **${targetTeam.name}** ${targetTeam.icon}\n\nTodos os jogadores devem entrar no canal <#1367543346469404756> para serem movidos automaticamente!`)
                    .setColor('#00FF00');

                await generalChannel.send({ embeds: [embed] });
                
                matches[matchId].status = 'aguardando_jogadores';
                saveData();

                interaction.reply({ content: 'Desafio aceito! Canais criados com sucesso!', ephemeral: true });
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_criar_time') {
                const nome = interaction.fields.getTextInputValue('nome_time');
                const corRGB = interaction.fields.getTextInputValue('cor_time');
                const icone = interaction.fields.getTextInputValue('icone_time');

                const rgbArray = corRGB.split(',').map(num => parseInt(num.trim()));
                if (rgbArray.length !== 3 || rgbArray.some(num => isNaN(num) || num < 0 || num > 255)) {
                    return interaction.reply({ content: 'Formato de cor inválido! Use: 255,0,0', ephemeral: true });
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
                        leader: interaction.user.id,
                        members: [interaction.user.id],
                        roleId: role.id,
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

                    interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error(error);
                    interaction.reply({ content: 'Erro ao criar o time!', ephemeral: true });
                }
            }
        }
    }
};