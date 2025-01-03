document.addEventListener('DOMContentLoaded', () => {
    // Initialize widgets
    const kickWidget = new KickWidget();
    const youtubeWidget = new YouTubeWidget();
    const twitchWidget = new TwitchWidget();
    const dliveWidget = new DLiveWidget();
    
    // Add DLive streamers
    dliveWidget.addStreamer('OfficialBjornTV');
    
    // DOM Elements
    const searchInput = document.querySelector('.search-input');
    const filterButtons = document.querySelectorAll('.filter-button');
    const refreshButton = document.querySelector('.refresh-button');
    const liveStreamers = document.getElementById('liveStreamers');
    const offlineStreamers = document.getElementById('offlineStreamers');
    const bannedStreamers = document.getElementById('bannedStreamers');
    const liveCount = document.getElementById('liveCount');
    const offlineCount = document.getElementById('offlineCount');
    const bannedCount = document.getElementById('bannedCount');
    const showMoreOffline = document.getElementById('showMoreOffline');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let currentFilter = 'all';
    let searchTerm = '';
    let allOfflineStreamers = [];
    const INITIAL_OFFLINE_COUNT = 3;
    let showingAllOffline = false;
    let initialLoad = true;

    // Load last seen times from localStorage
    let lastSeenTimes = JSON.parse(localStorage.getItem('lastSeenTimes') || '{}');
    // Track previous viewer counts for trend calculation
    let previousViewerCounts = JSON.parse(localStorage.getItem('previousViewerCounts') || '{}');

    function formatViewerCount(count) {
        if (!count && count !== 0) return '0';
        
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (count >= 1000) {
            return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return count.toString();
    }

    function calculateViewerTrend(streamer) {
        const key = `${streamer.platform}-${streamer.name}`;
        const previousCount = previousViewerCounts[key] || streamer.viewerCount;
        
        if (!streamer.isLive || !previousCount) return 0;

        const trend = ((streamer.viewerCount - previousCount) / previousCount) * 100;
        previousViewerCounts[key] = streamer.viewerCount;
        localStorage.setItem('previousViewerCounts', JSON.stringify(previousViewerCounts));
        
        return Math.round(trend);
    }

    function updateLastSeen(streamer) {
        if (streamer.isLive) {
            lastSeenTimes[`${streamer.platform}-${streamer.name}`] = new Date().toISOString();
            localStorage.setItem('lastSeenTimes', JSON.stringify(lastSeenTimes));
        }
    }

    function getLastSeenText(streamer) {
        const lastSeen = lastSeenTimes[`${streamer.platform}-${streamer.name}`];
        if (!lastSeen) return 'Never seen live';

        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffInSeconds = Math.floor((now - lastSeenDate) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
        return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    }

    let currentStreamers = {
        live: [],
        offline: [],
        banned: []
    };

    // Back to Top functionality
    const backToTop = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTop.style.display = 'flex';
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
            setTimeout(() => {
                if (!backToTop.classList.contains('visible')) {
                    backToTop.style.display = 'none';
                }
            }, 300);
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    async function refreshStreamers() {
        try {
            refreshButton.classList.add('loading');
            showingAllOffline = false;
            
            // Store previous banned streamers to compare
            const previousBannedStreamers = new Set(
                currentStreamers.banned.map(s => `${s.platform}-${s.name}`)
            );
            
            // Show loading skeletons
            const skeletonCount = 3;
            liveStreamers.innerHTML = '';
            for (let i = 0; i < skeletonCount; i++) {
                liveStreamers.appendChild(showLoadingSkeleton());
            }
            
            if (initialLoad) {
                loadingOverlay.style.display = 'flex';
                loadingOverlay.style.opacity = '1';
                loadingOverlay.classList.remove('fade-out');
            }
            
            const [kickData, youtubeData, twitchData, dliveData] = await Promise.all([
                kickWidget.getStreamerInfo(),
                youtubeWidget.getStreamerInfo(),
                twitchWidget.getStreamerInfo(),
                dliveWidget.getStreamerInfo()
            ]);

            if (initialLoad) {
                loadingOverlay.classList.add('fade-out');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    initialLoad = false;
                }, 300);
            }

            const allStreamers = [...kickData, ...youtubeData, ...twitchData, ...dliveData];
            allStreamers.forEach(updateLastSeen);

            // Check which previously banned streamers are no longer in the response
            const currentStreamersSet = new Set(
                allStreamers.map(s => `${s.platform}-${s.name}`)
            );
            
            // Remove streamers from banned list if they're no longer in the API response
            previousBannedStreamers.forEach(streamerId => {
                if (!currentStreamersSet.has(streamerId)) {
                    const [platform, name] = streamerId.split('-');
                    // Remove from banned list since we can't get their data anymore
                    currentStreamers.banned = currentStreamers.banned.filter(
                        s => !(s.platform === platform && s.name === name)
                    );
                }
            });

            // Store streamers in categories
            currentStreamers.live = allStreamers.filter(s => s.isLive && !s.isBanned)
                .map(streamer => ({
                    ...streamer,
                    viewerTrend: calculateViewerTrend(streamer)
                }))
                .sort((a, b) => b.viewerCount - a.viewerCount);

            currentStreamers.offline = allStreamers.filter(s => !s.isLive && !s.isBanned)
                .sort((a, b) => {
                    const aLastSeen = lastSeenTimes[`${a.platform}-${a.name}`] || '0';
                    const bLastSeen = lastSeenTimes[`${b.platform}-${b.name}`] || '0';
                    return new Date(bLastSeen) - new Date(aLastSeen);
                });

            currentStreamers.banned = allStreamers.filter(s => s.isBanned)
                .sort((a, b) => a.name.localeCompare(b.name));

            allOfflineStreamers = currentStreamers.offline;
            
            // Update display with current search term
            updateDisplay();
        } catch (error) {
            console.error('Error refreshing streamers:', error);
        } finally {
            refreshButton.classList.remove('loading');
        }
    }

    function updateDisplay() {
        const searchLower = searchTerm.toLowerCase();
        
        // Clear all sections
        liveStreamers.innerHTML = '';
        offlineStreamers.innerHTML = '';
        bannedStreamers.innerHTML = '';

        // Show/hide sections based on filter
        const liveSection = document.getElementById('liveSection');
        const offlineSection = document.getElementById('offlineSection');
        
        liveSection.style.display = currentFilter === 'offline' ? 'none' : 'block';
        offlineSection.style.display = currentFilter === 'live' ? 'none' : 'block';

        // Filter and display live streamers
        const filteredLive = currentStreamers.live.filter(streamer => 
            streamer.name.toLowerCase().includes(searchLower) &&
            (currentFilter === 'all' || currentFilter === 'live')
        );
        filteredLive.forEach(streamer => {
            liveStreamers.appendChild(createStreamerCard(streamer));
        });

        // Filter and display offline streamers
        const filteredOffline = currentStreamers.offline.filter(streamer => 
            streamer.name.toLowerCase().includes(searchLower) &&
            (currentFilter === 'all' || currentFilter === 'offline')
        );
        const offlineToShow = showingAllOffline ? filteredOffline : filteredOffline.slice(0, INITIAL_OFFLINE_COUNT);
        offlineToShow.forEach(streamer => {
            offlineStreamers.appendChild(createStreamerCard(streamer));
        });

        // Filter and display banned streamers
        const filteredBanned = currentStreamers.banned.filter(streamer => 
            streamer.name.toLowerCase().includes(searchLower)
        );
        filteredBanned.forEach(streamer => {
            bannedStreamers.appendChild(createStreamerCard(streamer));
        });

        // Update counts
        liveCount.textContent = filteredLive.length;
        offlineCount.textContent = filteredOffline.length;
        bannedCount.textContent = filteredBanned.length;

        // Show/hide "Show More" button
        showMoreOffline.style.display = 
            currentFilter !== 'live' && filteredOffline.length > INITIAL_OFFLINE_COUNT ? 'block' : 'none';
        showMoreOffline.textContent = showingAllOffline ? 'Show Less' : 'Show More Offline Streamers';
    }

    function toggleOfflineStreamers() {
        showingAllOffline = !showingAllOffline;
        updateDisplay();
    }

    function createStreamerCard(streamer) {
        // For banned streamers, create a div instead of an anchor
        const card = streamer.isBanned ? document.createElement('div') : document.createElement('a');
        
        if (!streamer.isBanned) {
            card.href = streamer.link;
            card.target = '_blank';
        }
        
        // Add all relevant classes at once
        const classes = [
            'streamer-card',
            streamer.platform.toLowerCase(),
            streamer.isLive ? 'live' : 'offline',  // Explicitly add 'offline' class
            streamer.isBanned ? 'banned' : '',
            // Add top-streamer class if this is the streamer with most viewers
            (streamer.isLive && currentStreamers.live.length > 0 && 
             streamer.viewerCount === Math.max(...currentStreamers.live.map(s => s.viewerCount))) ? 'top-streamer' : ''
        ].filter(Boolean);
        
        card.className = classes.join(' ');
        
        if (streamer.isBanned) {
            card.style.cursor = 'not-allowed';
        }

        // Create avatar container for better badge positioning
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'avatar-container';

        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = streamer.image;
        avatar.alt = `${streamer.name}'s avatar`;
        avatarContainer.appendChild(avatar);

        // Add top-streamer badge if this is the streamer with most viewers
        if (streamer.isLive && currentStreamers.live.length > 0 && 
            streamer.viewerCount === Math.max(...currentStreamers.live.map(s => s.viewerCount))) {
            const topBadge = document.createElement('div');
            topBadge.className = 'top-streamer-badge';
            topBadge.textContent = 'TOP LIVE';
            avatarContainer.appendChild(topBadge);
        }

        const info = document.createElement('div');
        info.className = 'streamer-info';

        const nameContainer = document.createElement('div');
        nameContainer.className = 'name-container';

        const name = document.createElement('span');
        name.className = 'streamer-name';
        name.textContent = streamer.name;

        const platformBadge = document.createElement('span');
        platformBadge.className = `platform-badge ${streamer.platform.toLowerCase()}`;
        platformBadge.textContent = streamer.platform;

        nameContainer.appendChild(name);
        nameContainer.appendChild(platformBadge);

        if (streamer.isBanned) {
            const bannedBadge = document.createElement('span');
            bannedBadge.className = 'banned-badge';
            bannedBadge.textContent = 'BANNED';
            nameContainer.appendChild(bannedBadge);
        }

        const title = document.createElement('div');
        title.className = 'stream-title';
        title.textContent = streamer.isBanned ? (streamer.banReason || "Channel Unavailable") : streamer.title;
        title.title = title.textContent;

        const meta = document.createElement('div');
        meta.className = 'stream-meta';

        if (streamer.isLive) {
            const liveBadge = document.createElement('span');
            liveBadge.className = 'live-badge';
            liveBadge.textContent = 'LIVE';
            
            const viewers = document.createElement('span');
            viewers.className = 'viewer-count';
            viewers.textContent = `${formatViewerCount(streamer.viewerCount)} viewers`;
            
            // Add viewer trend if available
            if (streamer.viewerTrend) {
                const trend = document.createElement('span');
                const isUp = streamer.viewerTrend > 0;
                trend.className = `viewer-trend ${isUp ? 'up' : 'down'}`;
                trend.innerHTML = `${isUp ? '↑' : '↓'} ${Math.abs(streamer.viewerTrend)}%`;
                meta.appendChild(trend);
            }
            
            meta.appendChild(liveBadge);
            meta.appendChild(viewers);
        } else if (!streamer.isBanned) {
            const lastSeen = document.createElement('span');
            lastSeen.className = 'last-seen';
            lastSeen.textContent = getLastSeenText(streamer);
            meta.appendChild(lastSeen);
        }

        info.appendChild(nameContainer);
        info.appendChild(title);
        info.appendChild(meta);

        card.appendChild(avatarContainer);
        card.appendChild(info);

        return card;
    }

    // Loading skeleton functionality
    function showLoadingSkeleton() {
        const skeleton = document.createElement('div');
        skeleton.className = 'streamer-card skeleton';
        skeleton.style.height = '80px';
        return skeleton;
    }

    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        updateDisplay();
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.textContent.toLowerCase();
            updateDisplay();
        });
    });

    refreshButton.addEventListener('click', refreshStreamers);
    showMoreOffline.addEventListener('click', toggleOfflineStreamers);

    // Scroll Progress
    const scrollProgress = document.querySelector('.scroll-progress');
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        scrollProgress.style.setProperty('--scroll-width', `${scrolled}%`);
    });

    // Initialize
    refreshStreamers();

    // Auto refresh every 2 minutes
    setInterval(refreshStreamers, 120000);
}); 