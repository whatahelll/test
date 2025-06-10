const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Bot online como ${client.user.tag}!`);
        
        const channel = client.channels.cache.get('1336151112729755709');
if (channel) {
    const embed = new EmbedBuilder()
        .setAuthor({ 
            name: 'Crie seu time',
            iconURL: client.user.avatarURL()
        })
        .setDescription('Clique no botão abaixo para criar seu time!')
        .setImage('https://i.imgur.com/Su1kbjp.png')
        .setColor('#FF6B35')
    

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('criar_time')
                .setLabel('Criar Time')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚡')
        );

    channel.send({ embeds: [embed], components: [row] });
}
    },
};