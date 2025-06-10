// utils/safeReply.js (arquivo completo)
async function safeReply(message, content) {
    try {
        if (message.channel && message.channel.isTextBased()) {
            return await message.reply(content);
        } else {
            console.log('Canal não está disponível no cache, tentando buscar...');
            const channel = await message.client.channels.fetch(message.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                if (typeof content === 'string') {
                    return await channel.send(content);
                } else if (content.embeds) {
                    return await channel.send({ embeds: content.embeds, components: content.components || [] });
                } else {
                    return await channel.send(content);
                }
            } else {
                console.log('Não foi possível enviar mensagem - canal não encontrado');
                return null;
            }
        }
    } catch (error) {
        console.error('Erro ao responder mensagem:', error);
        try {
            const channel = await message.client.channels.fetch(message.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                const safeContent = typeof content === 'string' ? content : 'Erro ao processar comando.';
                return await channel.send(safeContent);
            }
        } catch (fallbackError) {
            console.error('Erro no fallback de resposta:', fallbackError);
        }
        return null;
    }
}

module.exports = safeReply;