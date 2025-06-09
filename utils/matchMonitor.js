const fs = require('fs');
const { EmbedBuilder } = require('discord.js');

class MatchMonitor {
    constructor(client) {
        this.client = client;
        this.activeMonitors = new Map();
        this.startGlobalMonitor();
    }

    startGlobalMonitor() {
        console.log('Iniciando monitor global de partidas...');
        setInterval(() => {
            this.checkAllMatches();
        }, 15000);
    }

    async checkAllMatches() {
        let matches = {};
        let teams = {};
        
        try {
            matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
            teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
        } catch (error) {
            console.log('Erro ao carregar dados:', error);
            return;
        }

        const activeMatches = Object.values(matches).filter(match => 
            match.status === 'aguardando_jogadores'
        );

        console.log(`Verificando ${activeMatches.length} partidas aguardando jogadores...`);

        for (const match of activeMatches) {
            await this.checkMatchTimeout(match.id, match, teams, matches);
        }
    }

    async checkMatchTimeout(matchId, match, teams, matches) {
        try {
            console.log(`Verificando timeout para partida ${matchId}`);
            
            let guild = null;
            
            if (match.channels && match.channels.general) {
                const generalChannel = this.client.channels.cache.get(match.channels.general);
                if (generalChannel) {
                    guild = generalChannel.guild;
                    console.log(`Guild encontrada através do canal: ${guild.name} (${guild.id})`);
                } else {
                    console.log('Canal geral da partida não encontrado');
                }
            }
            
            if (!guild) {
                console.log('Tentando encontrar guild através da lista de guilds do bot...');
                guild = this.client.guilds.cache.first();
                if (guild) {
                    console.log(`Usando primeira guild disponível: ${guild.name} (${guild.id})`);
                } else {
                    console.log('Nenhuma guild encontrada');
                    return;
                }
            }

            const createdTime = new Date(match.createdAt).getTime();
            const currentTime = new Date().getTime();
            const timeElapsed = currentTime - createdTime;

            console.log(`Partida ${matchId}: ${Math.floor(timeElapsed / 1000)}s desde criação (limite: 120s)`);

            if (timeElapsed >= 120000) {
                console.log(`Partida ${matchId} expirada (${Math.floor(timeElapsed / 1000)}s), cancelando...`);
                await this.cancelMatch(matchId, match, teams, guild, matches);
            } else {
                console.log(`Partida ${matchId} ainda dentro do prazo (${Math.floor((120000 - timeElapsed) / 1000)}s restantes)`);
            }
        } catch (error) {
            console.error(`Erro ao verificar partida ${matchId}:`, error);
        }
    }

    async cancelMatch(matchId, match, teams, guild, matches) {
        try {
            console.log(`Iniciando cancelamento da partida ${matchId}`);
            
            const team1 = teams[match.team1];
            const team2 = teams[match.team2];

            if (!team1 || !team2) {
                console.log('Times não encontrados para a partida');
            }

            const embed = new EmbedBuilder()
                .setTitle('⏰ PARTIDA CANCELADA POR TIMEOUT')
                .setDescription(`A partida ${team1 && team2 ? `entre **${team1.name}** ${team1.icon} e **${team2.name}** ${team2.icon}` : ''} foi cancelada automaticamente.\n\n**Motivo:** Os jogadores não entraram no lobby dentro de 2 minutos.`)
                .setColor('#FF0000');

            const generalChannel = guild.channels.cache.get(match.channels?.general);
            if (generalChannel) {
                console.log('Enviando mensagem no canal geral da partida');
                try {
                    await generalChannel.send({ embeds: [embed] });
                } catch (error) {
                    console.log('Erro ao enviar mensagem no canal geral:', error);
                }
            } else {
                console.log('Canal geral da partida não encontrado');
            }

            const announcementChannel = guild.channels.cache.find(channel => 
                channel.name.includes('anuncio') || 
                channel.name.includes('announce') || 
                channel.id === '1381722215812169910'
            );
            
            if (announcementChannel) {
                console.log(`Enviando mensagem no canal de anúncios: ${announcementChannel.name}`);
                try {
                    await announcementChannel.send({ embeds: [embed] });
                } catch (error) {
                    console.log('Erro ao enviar mensagem no canal de anúncios:', error);
                }
            } else {
                console.log('Canal de anúncios não encontrado');
            }

            console.log('Deletando canais da partida...');
            
            if (match.lobbyChannelId) {
                const lobbyChannel = guild.channels.cache.get(match.lobbyChannelId);
                if (lobbyChannel) {
                    try {
                        console.log(`Deletando canal de lobby: ${lobbyChannel.name} (${lobbyChannel.id})`);
                        await lobbyChannel.delete();
                        console.log('Canal de lobby deletado com sucesso');
                    } catch (error) {
                        console.log('Erro ao deletar canal de lobby:', error.message);
                    }
                } else {
                    console.log(`Canal de lobby não encontrado. ID: ${match.lobbyChannelId}`);
                }
            }

            const category = guild.channels.cache.get(match.channels?.category);
            if (category) {
                console.log(`Categoria encontrada: ${category.name} (${category.id})`);
                
                const childChannels = category.children.cache;
                console.log(`Encontrados ${childChannels.size} canais filhos para deletar`);
                
                for (const [channelId, child] of childChannels) {
                    try {
                        console.log(`Deletando canal: ${child.name} (${child.id})`);
                        await child.delete();
                        console.log(`Canal ${child.name} deletado com sucesso`);
                    } catch (error) {
                        console.log(`Erro ao deletar canal ${child.name}:`, error.message);
                    }
                }
                
                try {
                    console.log(`Deletando categoria: ${category.name} (${category.id})`);
                    await category.delete();
                    console.log('Categoria deletada com sucesso');
                } catch (error) {
                    console.log('Erro ao deletar categoria:', error.message);
                }
            } else {
                console.log(`Categoria não encontrada. ID procurado: ${match.channels?.category}`);
                
                if (match.channels) {
                    const channelIds = [
                        match.channels.voice1,
                        match.channels.voice2,
                        match.channels.text1,
                        match.channels.text2,
                        match.channels.general
                    ].filter(id => id);
                    
                    console.log(`Tentando deletar ${channelIds.length} canais individuais`);
                    
                    for (const channelId of channelIds) {
                        try {
                            const channel = guild.channels.cache.get(channelId);
                            if (channel) {
                                console.log(`Deletando canal individual: ${channel.name} (${channel.id})`);
                                await channel.delete();
                                console.log(`Canal ${channel.name} deletado`);
                            } else {
                                console.log(`Canal ${channelId} não encontrado`);
                            }
                        } catch (error) {
                            console.log(`Erro ao deletar canal ${channelId}:`, error.message);
                        }
                    }
                }
            }

            delete matches[matchId];
            
            try {
                if (!fs.existsSync('./dados')) fs.mkdirSync('./dados');
                fs.writeFileSync('./dados/partidas.json', JSON.stringify(matches, null, 2));
                console.log(`Partida ${matchId} removida dos dados e arquivo salvo`);
            } catch (error) {
                console.error('Erro ao salvar dados após cancelamento:', error);
            }

            console.log(`Cancelamento da partida ${matchId} concluído`);

        } catch (error) {
            console.error(`Erro ao cancelar partida ${matchId}:`, error);
        }
    }

    startMonitoringMatch(matchId) {
        console.log(`Iniciando monitoramento específico para partida ${matchId}`);
        
        if (this.activeMonitors.has(matchId)) {
            clearTimeout(this.activeMonitors.get(matchId));
        }

        const timeout = setTimeout(async () => {
            console.log(`Timeout específico acionado para partida ${matchId}`);
            await this.checkSpecificMatch(matchId);
            this.activeMonitors.delete(matchId);
        }, 125000);

        this.activeMonitors.set(matchId, timeout);
    }

    stopMonitoringMatch(matchId) {
        console.log(`Parando monitoramento específico para partida ${matchId}`);
        if (this.activeMonitors.has(matchId)) {
            clearTimeout(this.activeMonitors.get(matchId));
            this.activeMonitors.delete(matchId);
        }
    }

    async checkSpecificMatch(matchId) {
        try {
            let matches = {};
            let teams = {};
            
            try {
                matches = JSON.parse(fs.readFileSync('./dados/partidas.json', 'utf8'));
                teams = JSON.parse(fs.readFileSync('./dados/times.json', 'utf8'));
            } catch (error) {
                console.log('Erro ao carregar dados para verificação específica');
                return;
            }

            const match = matches[matchId];
            if (!match) {
                console.log(`Partida ${matchId} não encontrada durante verificação específica`);
                return;
            }

            if (match.status !== 'aguardando_jogadores') {
                console.log(`Partida ${matchId} mudou de status: ${match.status}`);
                return;
            }

            let guild = null;
            if (match.channels && match.channels.general) {
                const generalChannel = this.client.channels.cache.get(match.channels.general);
                if (generalChannel) {
                    guild = generalChannel.guild;
                }
            }
            
            if (!guild) {
                guild = this.client.guilds.cache.first();
            }
            
            if (!guild) {
                console.log('Guild não encontrada para verificação específica');
                return;
            }

            await this.cancelMatch(matchId, match, teams, guild, matches);
        } catch (error) {
            console.error(`Erro na verificação específica da partida ${matchId}:`, error);
        }
    }
}

module.exports = MatchMonitor;