const fs = require('fs');

class MatchMonitor {
    constructor(client) {
        this.client = client;
        this.activeMonitors = new Map();
        this.startGlobalMonitor();
    }

    startGlobalMonitor() {
        setInterval(() => {
            this.checkAllMatches();
        }, 30000);
    }

    async checkAllMatches() {
        let matches = {};
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
        } catch (error) {
            return;
        }

        let teams = {};
        try {
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            return;
        }

        for (const matchId in matches) {
            const match = matches[matchId];
            
            if (match.status === 'aguardando_jogadores') {
                await this.checkMatchTimeout(matchId, match, teams);
            }
        }
    }

    async checkMatchTimeout(matchId, match, teams) {
        try {
            console.log(`Verificando timeout para partida ${matchId}`);
            
            const guild = this.client.guilds.cache.get('1336151112653869147');
            if (!guild) return;

            const createdTime = new Date(match.createdAt).getTime();
            const currentTime = new Date().getTime();
            const timeElapsed = currentTime - createdTime;

            if (timeElapsed >= 120000) {
                console.log(`Partida ${matchId} expirada, cancelando...`);
                await this.cancelMatch(matchId, match, teams, guild);
            }
        } catch (error) {
            console.error(`Erro ao verificar partida ${matchId}:`, error);
        }
    }

    async cancelMatch(matchId, match, teams, guild) {
        try {
            const team1 = teams[match.team1];
            const team2 = teams[match.team2];

            if (!team1 || !team2) return;

            const { EmbedBuilder } = require('discord.js');
            
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

            let matches = {};
            try {
                matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
            } catch (error) {
                matches = {};
            }

            delete matches[matchId];
            
            try {
                if (!fs.existsSync('./dados')) fs.mkdirSync('./dados');
                fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));
                console.log(`Partida ${matchId} cancelada e removida dos dados`);
            } catch (error) {
                console.error('Erro ao salvar dados após cancelamento:', error);
            }

        } catch (error) {
            console.error(`Erro ao cancelar partida ${matchId}:`, error);
        }
    }
}

module.exports = MatchMonitor;