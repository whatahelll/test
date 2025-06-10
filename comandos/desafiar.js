// comandos/desafiar.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'desafiar',
    description: 'Desafia outro time marcando sua role',
    execute: async (message, args, client) => {
        const fs = require('fs');
        
        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            teams = {};
        }

        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
        } catch (error) {
            matches = {};
        }

        function isTeamInMatch(teamId) {
            return Object.values(matches).some(match => 
                (match.team1 === teamId || match.team2 === teamId) && 
                (match.status === 'aguardando_jogadores' || match.status === 'em_andamento' || match.status === 'votando_vencedor')
            );
        }

        const challengerTeam = Object.values(teams).find(team => {
            if (team.leaders && Array.isArray(team.leaders)) {
                return team.leaders.includes(message.author.id);
            }
            if (team.leader) {
                return team.leader === message.author.id;
            }
            return false;
        });

        if (!challengerTeam) {
            return await safeReply(message, 'Você não é líder de nenhum time!');
        }

        if (isTeamInMatch(challengerTeam.id)) {
            return await safeReply(message, 'Seu time já está em uma partida! Finalize antes de desafiar outros times.');
        }

        const mentionedRole = message.mentions.roles.first();
        if (!mentionedRole) {
            return await safeReply(message, 'Você deve mencionar a role do time que deseja desafiar!\n**Exemplo:** `,desafiar @NomeDoTime`');
        }

        const targetTeam = Object.values(teams).find(team => team.roleId === mentionedRole.id);
        if (!targetTeam) {
            return await safeReply(message, 'Esta role não pertence a nenhum time registrado!');
        }

        if (challengerTeam.id === targetTeam.id) {
            return await safeReply(message, 'Você não pode desafiar seu próprio time!');
        }

        if (isTeamInMatch(targetTeam.id)) {
            return await safeReply(message, 'Este time já está em uma partida! Tente novamente mais tarde.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🔥 Desafio Enviado! 🔥')
            .setDescription(`O time **${challengerTeam.name}** ${challengerTeam.icon || ''} desafiou **${targetTeam.name}** ${targetTeam.icon || ''}!\n\nLíderes do **${targetTeam.name}**, aceitem ou recusem o desafio:`)
            .setColor(parseInt(challengerTeam.color.replace('#', ''), 16))
            .addFields(
                { name: '⚔️ Desafiante', value: `${challengerTeam.icon || ''} **${challengerTeam.name}**\nVitórias: ${challengerTeam.stats?.victories || 0}\nDerrotas: ${challengerTeam.stats?.defeats || 0}`, inline: true },
                { name: '🛡️ Desafiado', value: `${targetTeam.icon || ''} **${targetTeam.name}**\nVitórias: ${targetTeam.stats?.victories || 0}\nDerrotas: ${targetTeam.stats?.defeats || 0}`, inline: true }
            )
            .setFooter({ text: 'Apenas líderes do time desafiado podem aceitar/recusar' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`aceitar_desafio_${challengerTeam.id}_${targetTeam.id}`)
                    .setLabel('Aceitar Desafio')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⚔️'),
                new ButtonBuilder()
                    .setCustomId(`recusar_desafio_${challengerTeam.id}_${targetTeam.id}`)
                    .setLabel('Recusar Desafio')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

        try {
            let leaderMentions = '';
            
            if (targetTeam.leaders && Array.isArray(targetTeam.leaders)) {
                for (const leaderId of targetTeam.leaders) {
                    leaderMentions += `<@${leaderId}> `;
                }
            } else if (targetTeam.leader) {
                leaderMentions = `<@${targetTeam.leader}>`;
            }

            const challengeMessage = `🚨 **DESAFIO RECEBIDO!** 🚨\n\n${leaderMentions}\n\nSeu time foi desafiado!`;

            const sentMessage = await safeReply(message, { 
                content: challengeMessage,
                embeds: [embed], 
                components: [row] 
            });

            if (sentMessage) {
                console.log(`Desafio enviado: ${challengerTeam.name} vs ${targetTeam.name}`);
            }

        } catch (error) {
            console.error('Erro ao enviar desafio:', error);
            await safeReply(message, 'Erro ao enviar o desafio!');
        }
    }
};