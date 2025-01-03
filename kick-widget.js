class KickWidget {
    constructor() {
        // Main list of streamers to check
        this.streamers = [
            'kangjoel',      // KangJoel
            'burgerplanet',  // Burger Planet
            'cristravels',   // Cris Travels
            'bennymack',     // Benny Mack
            'captaingee',    // Captain Gee
            'jandro',        // Jandro
            'loulz',         // Loulz
            'asianandy',     // Asian Andy
            'crazytawn',     // Crazy Tawn
            'murda',         // Murda
            'bongbong_irl',  // Bong Bon Girl
            'ac7ionman',     // Ac7ionman
            'suspendas',     // Suspendas
            'wappyflanker',  // WappyFlanker
            'xgewnx',        // xGewnx
            'feef',          // Feef
            'dbr666',        // DBR666
            'ABZ',           // ABZ
            'fousey',        // Fousey
            'muratstyle',    // Murat Style
            'garydavid',     // Gary David
            'xenathewitch',  // Xena The Witch
            'iceposeidon',   // Ice Poseidon
            'kimmee',        // Kimmee
            'wvagabond',     // wvagabond
            'zlatirl',       // Zlatirl
            'sam',           // Sam
            'hyubsama',      // Hyubsama
            'jewelrancid',   // JewelRancid
            'attilabak',     // AttilaBak
            'chickenandy',   // ChickenAndy
            'AdrianahLee',   // AdrianahLee
            'pentiummania',  // Pentiummania
            'Mando',         // Mandp
            'Luplupka',      // Luplupka
            'ShakoMako',     // ShakoMako
            'Moxie',        // Moxie
            'Slightlyhomeless',        // Slightlyhomeless
            'Forrest22',        // Forrest22
            'nanapips',      // nanapips
        ];

        // Load banned streamers from localStorage
        this.bannedStreamers = new Set(JSON.parse(localStorage.getItem('bannedKickStreamers') || '[]'));
        
        // Add known banned streamers
        this.bannedStreamers.add('onesonicirl');
    }

    async getStreamerInfo() {
        // Combine active and banned streamers for checking
        const allStreamers = [...new Set([...this.streamers, ...this.bannedStreamers])];
        
        const streamerInfos = await Promise.all(
            allStreamers.map(async username => {
                try {
                    const response = await fetch(`https://kick.com/api/v1/channels/${username}`);
                    
                    // Check for banned channels (404 response)
                    if (response.status === 404) {
                        if (!this.bannedStreamers.has(username)) {
                            console.log(`New banned streamer detected: ${username}`);
                            this.bannedStreamers.add(username);
                            localStorage.setItem('bannedKickStreamers', JSON.stringify([...this.bannedStreamers]));
                        }
                        
                        return {
                            name: username,
                            title: "Channel Not Found",
                            viewers: 0,
                            image: 'https://i.imgur.com/WVBE8gY.png', // Default banned profile image
                            thumbnail: null,
                            category: null,
                            isLive: false,
                            isBanned: true,
                            platform: 'kick',
                            link: `https://kick.com/${username}`,
                            viewerCount: 0,
                            banReason: "Channel has been banned or deleted from Kick"
                        };
                    }

                    // If channel exists, remove from banned list if it was there
                    if (this.bannedStreamers.has(username)) {
                        console.log(`Streamer ${username} is no longer banned`);
                        this.bannedStreamers.delete(username);
                        localStorage.setItem('bannedKickStreamers', JSON.stringify([...this.bannedStreamers]));
                    }

                    if (!response.ok) {
                        throw new Error('API error');
                    }

                    const data = await response.json();
                    const isLive = data.livestream !== null;
                    
                    return {
                        name: data.user?.username || username,
                        title: isLive ? (data.livestream?.session_title || "No title") : "Offline",
                        viewers: isLive ? data.livestream?.viewer_count || 0 : 0,
                        image: data.user?.profile_pic || 'https://i.imgur.com/WVBE8gY.png',
                        thumbnail: isLive ? data.livestream?.thumbnail?.url : null,
                        category: isLive ? data.livestream?.categories?.[0]?.name || "Just Chatting" : null,
                        isLive: isLive,
                        isBanned: false,
                        platform: 'kick',
                        link: `https://kick.com/${username}`,
                        viewerCount: isLive ? data.livestream?.viewer_count || 0 : 0
                    };
                } catch (error) {
                    // Check if the error is due to a network error or other API issues
                    console.error(`Error fetching Kick streamer ${username}:`, error);
                    return {
                        name: username,
                        title: "Error fetching streamer data",
                        viewers: 0,
                        image: 'https://i.imgur.com/WVBE8gY.png',
                        thumbnail: null,
                        category: null,
                        isLive: false,
                        isBanned: false,
                        platform: 'kick',
                        link: `https://kick.com/${username}`,
                        viewerCount: 0
                    };
                }
            })
        );

        return streamerInfos;
    }
} 