class DLiveWidget {
    constructor() {
        this.streamers = [];
    }

    async getStreamerInfo() {
        try {
            const streamerData = [];
            
            for (const streamer of this.streamers) {
                try {
                    console.log(`Fetching data for DLive streamer: ${streamer}`);
                    const response = await fetch(`/api/dlive/${streamer}`);
                    
                    if (!response.ok) {
                        console.error(`Error response from DLive API:`, response.status, response.statusText);
                        const errorText = await response.text();
                        console.error('Error details:', errorText);
                        throw new Error('Failed to fetch streamer data');
                    }
                    
                    const data = await response.json();
                    console.log(`Received data for ${streamer}:`, data);
                    
                    streamerData.push({
                        platform: 'DLive',
                        name: data.displayName || streamer,
                        title: data.livestream?.title || '',
                        image: data.avatar || `https://dlive.tv/avatar/${streamer}`,
                        link: `https://dlive.tv/${streamer}`,
                        isLive: Boolean(data.livestream?.title),
                        viewerCount: parseInt(data.livestream?.watchingCount) || 0,
                        isBanned: false,
                        thumbnailUrl: data.livestream?.thumbnailUrl || null,
                        lastSeen: data.livestream?.createdAt || null,
                        followers: data.followers || 0,
                        category: data.livestream?.category || ''
                    });
                } catch (error) {
                    console.error(`Error fetching DLive streamer ${streamer}:`, error);
                    // Add streamer as offline if there's an error
                    streamerData.push({
                        platform: 'DLive',
                        name: streamer,
                        title: '',
                        image: `https://dlive.tv/avatar/${streamer}`,
                        link: `https://dlive.tv/${streamer}`,
                        isLive: false,
                        viewerCount: 0,
                        isBanned: false,
                        followers: 0,
                        category: ''
                    });
                }
            }
            
            return streamerData;
        } catch (error) {
            console.error('Error in DLive widget:', error);
            return [];
        }
    }

    addStreamer(username) {
        if (!this.streamers.includes(username)) {
            this.streamers.push(username);
        }
    }

    removeStreamer(username) {
        this.streamers = this.streamers.filter(s => s !== username);
    }
} 