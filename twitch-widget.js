// Twitch streamers list
const TWITCH_STREAMERS = {
    'dr_pauper': 'dr_pauper',
    'grimoire': 'grimoire',
    'ac7ionman': 'ac7ionman',
    'fientude': 'fientude',
    'shabbatai': 'shabbatai',
    'taximarceldenhaag': 'taximarceldenhaag',
    'moises': 'moises',
    'Amazoontje': 'amazoontje',
    'Forrest22TV': 'Forrest22TV',
};

class TwitchWidget {
    constructor() {
        this.streamers = TWITCH_STREAMERS;
    }

    async fetchChannelInfo(username) {
        try {
            // Get the API URL dynamically
            const apiUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000' 
                : window.location.origin;
                
            const response = await fetch(`${apiUrl}/api/twitch-live/${username}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            return {
                title: data.title,
                image: data.image,
                isLive: data.isLive,
                link: `https://twitch.tv/${username}`,
                viewers: data.viewers,
                viewerCount: data.viewers || 0,
                platform: 'twitch'
            };
        } catch (error) {
            console.error('Error fetching channel info:', error);
            return null;
        }
    }

    async getStreamerInfo() {
        const streamerInfos = [];
        for (const [name, username] of Object.entries(this.streamers)) {
            const info = await this.fetchChannelInfo(username);
            if (info) {
                streamerInfos.push({ name, ...info });
            }
        }
        return streamerInfos;
    }
} 