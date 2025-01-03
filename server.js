require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs/promises');
const helmet = require('helmet');

const app = express();

// Serve static files from the current directory
app.use(express.static(__dirname));

// Parse JSON bodies
app.use(express.json());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// Security middleware with modified CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "https:", "data:", "https://yt3.ggpht.com", "https://i.ytimg.com", "https://images.dlive.tv"],
            connectSrc: [
                "'self'", 
                "http://localhost:3000",
                "https://kick.com", 
                "https://www.youtube.com", 
                "https://youtube.com",
                "https://www.googleapis.com",
                "https://api.twitch.tv",
                "https://graphigo.prd.dlive.tv",
                "https://dlive.tv",
                "https://images.dlive.tv"
            ],
        }
    }
}));

// Force HTTPS redirect
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
});

// Serve static files with security headers
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, path) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        res.set('X-XSS-Protection', '1; mode=block');
        
        // Set correct MIME types for JavaScript files
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Serve images directory
app.use('/images', express.static(path.join(__dirname, 'images')));

// Serve JavaScript files explicitly
app.get('*.js', (req, res, next) => {
    res.type('application/javascript');
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Initialize directories when server starts
(async () => {
    try {
        const imagesDir = path.join(__dirname, 'images');
        const profilesDir = path.join(__dirname, 'images', 'profiles');
        
        try {
            await fs.access(imagesDir);
        } catch {
            await fs.mkdir(imagesDir);
        }
        
        try {
            await fs.access(profilesDir);
        } catch {
            await fs.mkdir(profilesDir);
        }
        
        console.log('Directories initialized');
    } catch (error) {
        console.error('Error initializing directories:', error);
    }
})();

// Function to handle YouTube profile pictures
async function ensureProfilePicture(channelId) {
    const imagePath = path.join(__dirname, 'images', 'profiles', `${channelId}.jpg`);
    
    try {
        await fs.access(imagePath);
        return `/images/profiles/${channelId}.jpg`;
    } catch {
        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`
            );
            
            if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);

            const data = await response.json();
            if (!data.items || data.items.length === 0) throw new Error('Channel not found');

            const profileUrl = data.items[0].snippet.thumbnails.high.url;
            const imageResponse = await fetch(profileUrl);
            if (!imageResponse.ok) throw new Error('Failed to download profile picture');

            const buffer = await imageResponse.buffer();
            await fs.writeFile(imagePath, buffer);
            
            return `/images/profiles/${channelId}.jpg`;
        } catch (error) {
            console.error(`Error downloading profile picture for ${channelId}:`, error);
            return null;
        }
    }
}

function extractViewerCount(html) {
    try {
        // First try to find the initial data
        const ytInitialDataMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
        if (ytInitialDataMatch) {
            const ytData = JSON.parse(ytInitialDataMatch[1]);
            console.log('Found ytInitialData');

            // Try to find viewer count in different data structures
            const possiblePaths = [
                // Path 1: Live chat viewer count
                () => {
                    const viewCount = ytData.contents?.liveChatRenderer?.initialDisplayState?.viewerCount;
                    if (viewCount) {
                        console.log('Found viewer count in live chat:', viewCount);
                        const count = parseInt(viewCount);
                        return isNaN(count) ? null : count;
                    }
                },
                // Path 2: Video primary info
                () => {
                    const contents = ytData.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
                    for (const content of contents) {
                        // Try multiple paths for view count
                        const viewCountPaths = [
                            content.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer?.viewCount?.runs?.[0]?.text,
                            content.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText,
                            content.videoPrimaryInfoRenderer?.viewCount?.viewCountRenderer?.text?.simpleText,
                            content.videoPrimaryInfoRenderer?.viewCount?.viewCountRenderer?.text?.runs?.[0]?.text,
                            content.videoPrimaryInfoRenderer?.viewCount?.viewCountRenderer?.text
                        ];

                        for (const viewCount of viewCountPaths) {
                            if (viewCount) {
                                const count = parseInt(viewCount.toString().replace(/[^0-9]/g, ''));
                                if (!isNaN(count)) {
                                    console.log('Found viewer count in primary info:', count);
                                    return count;
                                }
                            }
                        }
                    }
                },
                // Path 3: Header live status
                () => {
                    const header = ytData.header?.c4TabbedHeaderRenderer;
                    if (header?.isLiveNow) {
                        const badges = header.badges || [];
                        for (const badge of badges) {
                            const text = badge.metadataBadgeRenderer?.label;
                            if (text && text.includes('watching')) {
                                const count = parseInt(text.replace(/[^0-9]/g, ''));
                                console.log('Found viewer count in header badge:', count);
                                return isNaN(count) ? null : count;
                            }
                        }
                    }
                },
                // Path 4: Video renderer
                () => {
                    const videoRenderer = ytData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
                        content => content.videoSecondaryInfoRenderer
                    );
                    if (videoRenderer?.videoSecondaryInfoRenderer?.metadataRowContainer?.metadataRowContainerRenderer?.rows) {
                        const rows = videoRenderer.videoSecondaryInfoRenderer.metadataRowContainer.metadataRowContainerRenderer.rows;
                        for (const row of rows) {
                            const text = row.metadataRowRenderer?.contents?.[0]?.runs?.[0]?.text;
                            if (text && text.includes('watching')) {
                                const count = parseInt(text.replace(/[^0-9]/g, ''));
                                console.log('Found viewer count in metadata:', count);
                                return isNaN(count) ? null : count;
                            }
                        }
                    }
                }
            ];

            // Try each path
            for (const path of possiblePaths) {
                const result = path();
                if (result !== null && result !== undefined) return result;
            }
        }

        // If we couldn't find the count in ytInitialData, try regex patterns
        const patterns = [
            /\"viewCount\":\{\"runs\":\[\{\"text\":\"([\d,]+)\"/,
            /\"viewCount\":\{\"simpleText\":\"([\d,]+)\"/,
            /\"shortViewCount\":\{\"simpleText\":\"([\d,]+)\"/,
            /"watchingCount":"([\d,]+)"/,
            /"viewerCount":"([\d,]+)"/,
            /\"currentViewCount\":\"([\d,]+)\"/,
            /\"watching\s*now\"[^>]*>([\d,]+)/i,
            /\"watching\"[^>]*>([\d,]+)/i,
            /(\d+)\s*watching/i,
            /watching\s*(\d+)/i,
            /"viewCount":\s*"(\d+)"/,
            /"watchingCount":\s*"(\d+)"/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                const count = parseInt(match[1].replace(/[^0-9]/g, ''));
                console.log('Found viewer count with pattern:', count);
                return isNaN(count) ? 0 : count;
            }
        }

        // Try to find raw viewer count in the HTML
        const rawHtml = html.toString();
        const viewerMatches = rawHtml.match(/(\d+)\s*(viewers?|watching|viewers\s+now)/i);
        if (viewerMatches) {
            const count = parseInt(viewerMatches[1]);
            console.log('Found raw viewer count:', count);
            return isNaN(count) ? 0 : count;
        }

        console.log('No valid viewer count found');
        return 0;
    } catch (error) {
        console.error('Error extracting viewer count:', error);
        return 0;
    }
}

app.get('/api/check-live/:channelId', async (req, res) => {
    try {
        const { channelId } = req.params;
        
        // First check the channel page
        const channelResponse = await fetch(`https://www.youtube.com/channel/${channelId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        let html = await channelResponse.text();
        
        // Try to find a live video ID
        let isLive = false;
        let videoId = null;
        
        const patterns = [
            /"liveStreamabilityRenderer":.*?"videoId":"([^"]+)"/,
            /"videoId":"([^"]+)","thumbnail".*?"isLive":true/,
            /{"videoId":"([^"]+)","author".*?"isLive":true/,
            /\\"isLive\\":true.*?\\"videoId\\":\\"([^\\]+)\\"/
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                videoId = match[1];
                break;
            }
        }
        
        if (videoId) {
            // If we found a live video ID, fetch that page directly
            const videoResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            html = await videoResponse.text();
            isLive = true;
        } else {
            // Try the /live endpoint
            const liveResponse = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            const liveHtml = await liveResponse.text();
            
            // Check if this page indicates a live stream
            if (
                liveHtml.includes('"isLive":true') || 
                liveHtml.includes('watching now') ||
                liveHtml.includes('"status":"LIVE"') ||
                liveHtml.includes('BADGE_STYLE_TYPE_LIVE')
            ) {
                html = liveHtml;
                isLive = true;
            }
        }
        
        console.log(`Channel ${channelId} live status:`, isLive);
        
        let title = 'Offline';
        let viewers = '';
        
        if (isLive) {
            // Try to extract title
            const titlePatterns = [
                /"title":\s*{\s*"runs":\s*\[{\s*"text":\s*"([^"]+)"/,
                /"title":\s*"([^"]+)"/,
                /<title>([^<]*)<\/title>/,
                /videoTitle":"([^"]+)"/
            ];

            for (const pattern of titlePatterns) {
                const match = html.match(pattern);
                if (match) {
                    title = match[1].replace('- YouTube', '').trim();
                    break;
                }
            }
            
            // Extract viewer count
            viewers = extractViewerCount(html);
            console.log(`Final viewer count for ${channelId}:`, viewers);
        }

        // Get or download profile picture
        const imagePath = await ensureProfilePicture(channelId);
        
        const result = {
            isLive,
            title,
            viewers,
            image: imagePath || `https://yt3.ggpht.com/channel/${channelId}`
        };
        
        console.log('Sending response:', result);
        res.json(result);
    } catch (error) {
        console.error('Error checking live status:', error);
        res.status(500).json({ error: 'Failed to check live status' });
    }
});

// Add Twitch API endpoint
app.get('/api/twitch-live/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const clientId = process.env.TWITCH_CLIENT_ID;
        const authToken = process.env.TWITCH_AUTH_TOKEN;
        
        const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!userResponse.ok) {
            throw new Error(`HTTP error! status: ${userResponse.status}`);
        }
        
        const userData = await userResponse.json();
        if (!userData.data || userData.data.length === 0) {
            return res.json({
                isLive: false,
                title: 'Offline',
                viewers: 0,
                image: null
            });
        }
        
        const userId = userData.data[0].id;
        const profileImage = userData.data[0].profile_image_url;
        
        // Check if user is streaming
        const streamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!streamResponse.ok) {
            throw new Error(`HTTP error! status: ${streamResponse.status}`);
        }
        
        const streamData = await streamResponse.json();
        const isLive = streamData.data && streamData.data.length > 0;
        
        if (isLive) {
            const stream = streamData.data[0];
            return res.json({
                isLive: true,
                title: stream.title,
                viewers: stream.viewer_count,
                image: profileImage
            });
        } else {
            return res.json({
                isLive: false,
                title: 'Offline',
                viewers: 0,
                image: profileImage
            });
        }
    } catch (error) {
        console.error('Error checking Twitch status:', error);
        res.status(500).json({ 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Failed to check Twitch status' 
        });
    }
});

app.get('/api/dlive/:username', async (req, res) => {
    try {
        const username = req.params.username;
        console.log('Fetching DLive data for username:', username);
        
        const query = `
            query {
                userByDisplayName(displayname: "${username}") {
                    displayname
                    avatar
                    username
                    partnerStatus
                    livestream {
                        title
                        watchingCount
                        thumbnailUrl
                        createdAt
                        category {
                            title
                        }
                    }
                    followers {
                        totalCount
                    }
                }
            }
        `;

        console.log('Sending request to DLive API...');
        const response = await fetch('https://graphigo.prd.dlive.tv/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://dlive.tv',
                'Referer': 'https://dlive.tv/',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            body: JSON.stringify({ 
                query,
                variables: null,
                operationName: null
            })
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Response body:', responseText);

        if (!response.ok) {
            throw new Error(`DLive API request failed: ${response.status} ${response.statusText}`);
        }

        const data = JSON.parse(responseText);
        
        // Check for GraphQL errors
        if (data.errors) {
            console.error('DLive GraphQL errors:', JSON.stringify(data.errors, null, 2));
            throw new Error(data.errors[0].message);
        }

        // Check if user exists
        if (!data.data || !data.data.userByDisplayName) {
            console.log('User not found:', username);
            return res.status(404).json({ error: 'Streamer not found' });
        }

        const userData = data.data.userByDisplayName;
        const responseData = {
            displayName: userData.displayname,
            avatar: userData.avatar,
            livestream: {
                title: userData.livestream?.title || '',
                watchingCount: userData.livestream?.watchingCount || 0,
                isLive: Boolean(userData.livestream), // If livestream exists, they're live
                thumbnailUrl: userData.livestream?.thumbnailUrl || '',
                createdAt: userData.livestream?.createdAt || null,
                category: userData.livestream?.category?.title || ''
            },
            followers: userData.followers?.totalCount || 0
        };
        
        console.log('Sending response:', JSON.stringify(responseData, null, 2));
        res.json(responseData);
    } catch (error) {
        console.error('Detailed DLive API error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            error: 'Failed to fetch DLive streamer data',
            details: error.message
        });
    }
});

// Update the port configuration
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 