// YouTube streamers list
const YOUTUBE_STREAMERS = {
    'OGGEEZER': 'UC229CRwYN8oJ_2_rBN-7wwg',
    'Carl I': 'UCk-CQ9KSZtlh-VcBwxZGBPQ',
    'Goodtimes4Life': 'UCX7kqOjVtjZdOQ86u9nfWeQ',
    'Pebbies': 'UCUNfKvI45t9zMsuLzbqigqA',
    'KipOnTheGround': 'UCRjH9vXg5gGgEzQjXO99HXg',
    'One Sonic': 'UCDDrY00FPYwLp9VqRhWiDgg',
    'EBZ': 'UCUn24NHjc8asGiYet1P9h5Q',
    'Hyphonix': 'UCaFpm67qMk1W1wJkFhGXucA',
    'Jose Sanders Journeys': 'UCAp3jeyngZslUEx_D1djgHg',
    'Saint10': 'UCOZ4ZOIAPlEFOgGIqj7jlMg',
    'Scuffed Justin Carrey': 'UC4YYNTbzt3X1uxdTCJaYWdg',
    'ShoeNice 22': 'UCyuCA6viLm6zsL6LNq67Tjg',
    'Anarchy Princcess': 'UCbBoUd6b5MzLDaTXVjQ9A5g',
    'Homeless Shelter RV': 'UCiQp2PKJeFFREfmH3HbjsEQ',
    'Eugene': 'UCrmRz3rpk-wbIlMQdCMS2FQ',
    'Mr Based Live': 'UCvGi96uLKTsJB1CI-8o2hqw',
    'Forrest22': 'UCl3UvyhAU471GHXhdpFVbQA',
};

class YouTubeWidget {
    constructor() {
        this.streamers = YOUTUBE_STREAMERS;
    }

    async fetchChannelInfo(channelId) {
        try {
            // Get the API URL dynamically
            const apiUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000' 
                : window.location.origin;
                
            const response = await fetch(`${apiUrl}/api/check-live/${channelId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Enhanced check for actual live streams vs scheduled
            const lowerTitle = data.title?.toLowerCase() || '';
            const scheduledKeywords = [
                'premiere',
                'scheduled',
                'starting soon',
                'live stream',
                'test',
                'live test',
                'going live',
                '🔴live',
                '🔴 live',
                'live.',
                'live!'
            ];

            // Check if title contains any scheduled keywords
            const hasScheduledKeywords = scheduledKeywords.some(keyword => 
                lowerTitle.includes(keyword)
            );

            // More strict live check
            const isActuallyLive = data.isLive && 
                                 data.viewers && 
                                 data.viewers > 1 && // Require more than 1 viewer
                                 !hasScheduledKeywords &&
                                 !lowerTitle.startsWith('live') && // Many scheduled streams start with "LIVE"
                                 !lowerTitle.endsWith('live'); // or end with "LIVE"
            
            return {
                title: data.title,
                image: data.image,
                isLive: isActuallyLive,
                link: isActuallyLive 
                    ? `https://www.youtube.com/channel/${channelId}/live`
                    : `https://www.youtube.com/channel/${channelId}`,
                viewers: isActuallyLive ? data.viewers : 0,
                viewerCount: isActuallyLive && data.viewers 
                    ? (typeof data.viewers === 'number' 
                        ? data.viewers 
                        : parseInt(data.viewers.toString().replace(/[^0-9]/g, '')) || 0)
                    : 0,
                platform: 'youtube'
            };
        } catch (error) {
            console.error('Error fetching channel info:', error);
            return null;
        }
    }

    async getStreamerInfo() {
        const streamerInfos = [];
        for (const [name, channelId] of Object.entries(this.streamers)) {
            const info = await this.fetchChannelInfo(channelId);
            if (info) {
                streamerInfos.push({ name, ...info });
            }
        }
        return streamerInfos;
    }
} 