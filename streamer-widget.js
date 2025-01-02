class StreamerWidget {
    constructor() {
        this.liveStreamers = [];
        this.offlineStreamers = [];
        this.template = document.getElementById('streamer-card-template');
        this.liveContainer = document.getElementById('live-streamers');
        this.offlineContainer = document.getElementById('offline-streamers');
        
        // Initialize platform widgets
        this.youtubeWidget = new YouTubeWidget();
        this.kickWidget = new KickWidget();
        this.twitchWidget = new TwitchWidget();
        
        // Initialize event listeners
        this.initializeEventListeners();
        
        // Start periodic refresh
        this.refreshAll();
        setInterval(() => this.refreshAll(), 60000);
    }

    initializeEventListeners() {
        // Search functionality
        const searchInput = document.querySelector('.search-input');
        searchInput.addEventListener('input', (e) => this.filterStreamers(e.target.value));

        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.filterByStatus(button.textContent.toLowerCase());
            });
        });

        // Refresh button
        const refreshButton = document.querySelector('.refresh-button');
        refreshButton.addEventListener('click', () => this.refreshAll());
    }

    async refreshAll() {
        // Clear existing streamers
        this.liveStreamers = [];
        this.offlineStreamers = [];
        
        // Show loading state
        this.showLoadingState();
        
        try {
            // Fetch data from different platforms
            const [youtubeStreamers, kickStreamers, twitchStreamers] = await Promise.all([
                this.fetchYouTubeData(),
                this.fetchKickData(),
                this.fetchTwitchData()
            ]);
            
            // Process YouTube streamers
            youtubeStreamers.forEach(streamer => {
                const processedStreamer = {
                    name: streamer.name,
                    title: streamer.title,
                    profilePic: streamer.image,
                    thumbnail: streamer.image,
                    viewers: streamer.viewerCount,
                    isLive: streamer.isLive,
                    platform: 'YouTube',
                    url: streamer.link,
                    category: 'Live Stream',
                    uptime: 'Live'
                };

                if (streamer.isLive) {
                    this.liveStreamers.push(processedStreamer);
                } else {
                    this.offlineStreamers.push(processedStreamer);
                }
            });
            
            // Process Kick streamers
            kickStreamers.forEach(streamer => {
                const processedStreamer = {
                    name: streamer.name,
                    title: streamer.title,
                    profilePic: streamer.image,
                    thumbnail: streamer.thumbnail || streamer.image,
                    viewers: streamer.viewerCount,
                    isLive: streamer.isLive,
                    platform: 'Kick',
                    url: streamer.link,
                    category: streamer.category || 'Live Stream',
                    uptime: 'Live'
                };

                if (streamer.isLive) {
                    this.liveStreamers.push(processedStreamer);
                } else {
                    this.offlineStreamers.push(processedStreamer);
                }
            });

            // Process Twitch streamers
            twitchStreamers.forEach(streamer => {
                const processedStreamer = {
                    name: streamer.name,
                    title: streamer.title,
                    profilePic: streamer.image,
                    thumbnail: streamer.thumbnail || streamer.image,
                    viewers: streamer.viewerCount,
                    isLive: streamer.isLive,
                    platform: 'Twitch',
                    url: streamer.link,
                    category: streamer.category || 'Live Stream',
                    uptime: streamer.uptime || 'Live'
                };

                if (streamer.isLive) {
                    this.liveStreamers.push(processedStreamer);
                } else {
                    this.offlineStreamers.push(processedStreamer);
                }
            });
            
            // Update the UI
            this.updateUI();
        } catch (error) {
            console.error('Error refreshing streamer data:', error);
            // Show error state in UI
            this.liveContainer.innerHTML = '<div class="streamer-card">Error loading streamers. Please try again.</div>';
            this.offlineContainer.innerHTML = '';
        }
    }

    showLoadingState() {
        this.liveContainer.innerHTML = this.createLoadingCards(3);
        this.offlineContainer.innerHTML = this.createLoadingCards(3);
    }

    createLoadingCards(count) {
        return Array(count).fill(0).map(() => `
            <div class="streamer-card" style="opacity: 0.5">
                <div class="profile-pic" style="background: rgba(255,255,255,0.1)"></div>
                <div class="streamer-info">
                    <div class="streamer-name">
                        <div style="width: 150px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 4px;"></div>
                    </div>
                    <div class="stream-title">
                        <div style="width: 200px; height: 16px; background: rgba(255,255,255,0.1); border-radius: 4px;"></div>
                    </div>
                </div>
                <div class="status-container">
                    <div style="width: 80px; height: 24px; background: rgba(255,255,255,0.1); border-radius: 4px;"></div>
                </div>
            </div>
        `).join('');
    }

    createStreamerCard(streamer) {
        const card = this.template.content.cloneNode(true);
        const cardElement = card.querySelector('.streamer-card');
        
        // Set card link
        cardElement.href = streamer.url;
        
        // Set profile picture
        const profilePic = card.querySelector('.profile-pic');
        profilePic.src = streamer.profilePic;
        profilePic.alt = streamer.name;
        
        // Set name and platform badge
        card.querySelector('.name-text').textContent = streamer.name;
        const platformBadge = card.querySelector('.platform-badge');
        platformBadge.textContent = streamer.platform;
        platformBadge.classList.add(streamer.platform.toLowerCase());
        
        // Set stream title
        card.querySelector('.stream-title').textContent = streamer.title || 'Offline';
        
        // Set status container
        const statusContainer = card.querySelector('.status-container');
        if (streamer.isLive) {
            const viewerCount = card.querySelector('.viewer-count');
            viewerCount.textContent = this.formatViewerCount(streamer.viewers);
            
            // Set preview card data if available
            if (streamer.thumbnail) {
                const previewCard = card.querySelector('.preview-card');
                previewCard.querySelector('.preview-thumbnail').src = streamer.thumbnail;
                previewCard.querySelector('.stream-title').textContent = streamer.title;
                previewCard.querySelector('.preview-uptime').textContent = streamer.uptime || 'Just started';
                
                if (streamer.viewerTrend) {
                    const trendElement = previewCard.querySelector('.viewer-trend');
                    trendElement.textContent = streamer.viewerTrend > 0 ? `+${streamer.viewerTrend}` : streamer.viewerTrend;
                    trendElement.classList.add(streamer.viewerTrend > 0 ? 'up' : 'down');
                }
                
                if (streamer.category) {
                    previewCard.querySelector('.stream-category').textContent = streamer.category;
                }
            }
        } else {
            statusContainer.querySelector('.viewer-count').remove();
            statusContainer.querySelector('.live-badge').remove();
        }
        
        return card;
    }

    formatViewerCount(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
    }

    updateUI() {
        // Sort streamers by viewer count
        this.liveStreamers.sort((a, b) => (b.viewers || 0) - (a.viewers || 0));
        
        // Clear containers
        this.liveContainer.innerHTML = '';
        this.offlineContainer.innerHTML = '';
        
        // Add live streamers
        this.liveStreamers.forEach(streamer => {
            this.liveContainer.appendChild(this.createStreamerCard(streamer));
        });
        
        // Add offline streamers
        this.offlineStreamers.forEach(streamer => {
            this.offlineContainer.appendChild(this.createStreamerCard(streamer));
        });
        
        // Update counters in section titles
        document.querySelector('.section-title').textContent = `Live Streamers (${this.liveStreamers.length})`;
        document.querySelectorAll('.section-title')[1].textContent = `Offline Streamers (${this.offlineStreamers.length})`;
    }

    filterStreamers(query) {
        const normalizedQuery = query.toLowerCase();
        const cards = document.querySelectorAll('.streamer-card');
        
        cards.forEach(card => {
            const name = card.querySelector('.name-text').textContent.toLowerCase();
            const title = card.querySelector('.stream-title').textContent.toLowerCase();
            const shouldShow = name.includes(normalizedQuery) || title.includes(normalizedQuery);
            card.style.display = shouldShow ? '' : 'none';
        });
    }

    filterByStatus(status) {
        const sections = document.querySelectorAll('.section');
        
        if (status === 'all') {
            sections.forEach(section => section.style.display = '');
        } else if (status === 'live') {
            sections[0].style.display = '';
            sections[1].style.display = 'none';
        } else if (status === 'offline') {
            sections[0].style.display = 'none';
            sections[1].style.display = '';
        }
    }

    async fetchYouTubeData() {
        return await this.youtubeWidget.getStreamerInfo();
    }

    async fetchKickData() {
        return await this.kickWidget.getStreamerInfo();
    }

    async fetchTwitchData() {
        return await this.twitchWidget.getStreamerInfo();
    }
}

// Initialize the widget
const streamerWidget = new StreamerWidget(); 