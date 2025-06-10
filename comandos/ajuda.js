const { EmbedBuilder } = require('discord.js');
const safeReply = require('../utils/safeReply');

module.exports = {
    name: 'ajuda',
    description: 'Mostra todos os comandos disponíveis',
    execute: async (message, args, client) => {
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: '🔥 Comandos Free Fire Bot 🔥',
                iconURL: client.user.avatarURL()
            })
            .setDescription('Lista de todos os comandos disponíveis:')
            .setColor('#FF6B35')
            .setThumbnail(message.guild.iconURL())
            .addFields(
                {
                    name: '👥 **Comandos de Times**',
                    value: '`,times` - Lista todos os times disponíveis\n`,stats` - Mostra as estatísticas do seu time\n`,ranking` - Mostra o ranking dos times\n`,desafiar @time` - Desafia outro time marcando sua role',
                    inline: false
                },
                {
                    name: '👑 **Comandos de Liderança (Líderes)**',
                    value: '`,convidar @membro` - Convida um membro para seu time\n`,convites` - Mostra os convites pendentes do seu time\n`,remover @membro` - Remove um membro do seu time\n`,editar` - Mostra opções de edição do time\n`,editar icone <emoji>` - Altera o ícone do time\n`,editar prefixo <texto>` - Define prefixo do time\n`,editar prefixo remover` - Remove o prefixo\n`,deletar` - Deleta seu time',
                    inline: false
                },
                {
                    name: '👑 **Comandos de Criador (Apenas Criador)**',
                    value: '`,promover @membro` - Promove um membro a líder\n`,rebaixar @membro` - Remove a liderança de um membro',
                    inline: false
                },
                {
                    name: '⚔️ **Comandos de Partidas**',
                    value: '`,partidas` - Mostra as partidas ativas\n`,iniciar` - Inicia a partida (líderes dos times)\n`,finalizar` - Inicia votação para finalizar partida\n`,cancelar` - Cancela a partida atual (líderes)\n`,emissor @membro` - Escolhe um emissor para transmitir',
                    inline: false
                },
                {
                    name: '👤 **Comandos Pessoais**',
                    value: '`,sair` - Sair do seu time atual',
                    inline: false
                },
                {
                    name: '📋 **Como Funciona**',
                    value: '• Use o botão "Criar Time" no canal principal\n• Convide membros para seu time\n• Desafie outros times com `,desafiar @NomeDoTime`\n• Entre no canal de lobby para participar das partidas\n• Líderes devem confirmar o início com `,iniciar`\n• Use `,emissor @usuario` para escolher quem vai transmitir\n• Vote no final das partidas para determinar o vencedor',
                    inline: false
                },
                {
                    name: '⚙️ **Permissões**',
                    value: '**Líder:** Pode convidar, remover membros, editar time, iniciar/cancelar partidas, desafiar outros times, escolher emissor\n**Criador:** Todas as permissões de líder + promover/rebaixar outros líderes\n**Membro:** Pode participar de partidas e votar em finalizações',
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Use , antes de cada comando | Exemplo: ,desafiar @NomeDoTime'
            })
            .setTimestamp();

        await safeReply(message, { embeds: [embed] });
    }
};