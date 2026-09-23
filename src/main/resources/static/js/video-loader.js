// Video Loader for Skopia Dashboard

class VideoLoader {

    static async loadRecommendedVideos() {
        try {
            // Mock data - replace with actual API call
            const videos = [
                {
                    id: 1,
                    title: "The Future of Generative AI 2026: Architectures That Redefined Everything",
                    channel: "Alex Vance",
                    channelVerified: true,
                    views: "128K",
                    daysAgo: "3 days ago",
                    duration: "24:18",
                    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDAewaloHlZZR7Siw9QL_ntyemQUe_k0-zo-xBsdgEt2qB2Nyi50uMsBOdLi6LOo8FNrCu6Sci2IdnDIEdNR3mqGW0cwjRk7QvA9LrmIX4yURYGuvk7QXi8tTlaoGRPMkj3I6Fr06q1nFeSDBolfPPQEx_aTAtUgiSo3geTYifYI6noakBEgWk1nNiLm_m9zVsQIzNmhQmwni6bIo8OZNGjMmWXXeI-kfc-0ESM7N3slgtcMPjWCde9-A",
                    category: "Tech & AI",
                    tags: ["GenerativeAI"],
                    accessTier: "FREE",
                    rating: 4.9
                },
                {
                    id: 2,
                    title: "Global Geopolitics & Economic Summit: Unfiltered Closed-Door Debates",
                    channel: "World Forum",
                    channelVerified: true,
                    views: "85K",
                    daysAgo: "1 day ago",
                    duration: "41:05",
                    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDaUunAAo4kHV862G2f5eDDlfKQQu4du5lYv16g_5gdNtrXeu5cw1nF1s0rYjpbez9WBGyz3Bqv3M3Dg7uHAjmQ8abo153yxp-STrRGlzCBfkwzh2FBZixeUo7pgj6NnEKLVbnLRHSiawHSY9i9fO7rEhrtjMsJrSb63o_YMDFQhcm5sRoejLO-1BFd7QhAGDKQNypBQrQBaLyWL2cmqMt6hbRNl5hkV0E5DbRYBl35S6vljv1H0JEhNg",
                    category: "Politics & Affairs",
                    tags: ["Economy"],
                    accessTier: "PREMIUM",
                    rating: null
                },
                {
                    id: 3,
                    title: "Mastering Guitar Soloing: Complete Masterclass & Tabs Walkthrough",
                    channel: "Sarah Chen",
                    channelVerified: true,
                    views: "42K",
                    daysAgo: "5 days ago",
                    duration: "32:10",
                    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuAmcP9VA4ddyjOxJItHKu0qufOo6viakplJhbby-64OwoCrRRqhv9I0mK2YA7RLUkiLEdPeKCSRGAKIEdSAjQgMzonEUtyedkJ4SC506PRVmVPG2Kbk92AQhWxMxZ_MCVcG_lTyJStILLWLquZsto5tdE3PoRLd2OY2dDKqGK3XEX1BwaubNMOcRmCkzzC0wFYAfYtJWwe1YDFhUDIxdEZoI-PilhKzcAQRJ8tfrQW7SG9Pz0-YL_3tCA",
                    category: "Music",
                    tags: ["Masterclass"],
                    accessTier: "PREMIUM",
                    rating: null
                },
                {
                    id: 4,
                    title: "Funny University Campus Moments & Exam Week Skits",
                    channel: "Kavi Vlogs",
                    channelVerified: false,
                    views: "340K",
                    daysAgo: "6 days ago",
                    duration: "14:45",
                    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuCWtAhKSu9Wzr5QyZqPbEKV_ZmO6aIQkRnCPiU38veVnf6cL1h6e5-grfdFMvElpRCW7jEyDHsJp01bHla_ppg1vd3FrjoYm6XCkzPlG49HC4MEC9NVuOAn8FYt3vBnoVW9wufFJqAr3er-oMbEPRDEVD2GNL7VJ8mdCAh8ty6nu7z0IA_FYHuhBvfMXB3Wj9-KK4RCq3jAeQWRIunhjhQFLD8XlXyYWW2HbUilMuNDL2fYNtbkN407wg",
                    category: "Entertainment",
                    tags: ["Students"],
                    accessTier: "FREE",
                    rating: null
                }
            ];

            this.renderVideoGrid(videos, 'recommended-grid');
        } catch (error) {
            console.error('Error loading videos:', error);
        }
    }

    static async loadContinueWatching() {
        try {
            // Mock data - replace with actual API call
            const videos = [
                {
                    id: 1,
                    title: "AI Tools & Neural Networks 2026 Tutorial",
                    channel: "Tech & AI",
                    duration: "20:15 / 38:00",
                    progress: 53,
                    remaining: "17m left",
                    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDEN3kN6-qFYsuulGvGh3noaBdvkDMhb_EGj4zYT71EDAN13L-RvIF1am9hRW4iij6a-4LdslNzVr1Pw8X5M6uPozZ13Tdd10RCh-ukQmOjY0FNf9AZYutlsB_0H0aaIorhFQ_bapcJavp_hDeVVIs2qImwNs7-OMmvl59FtCb8N8ky1eD1psdt4R_5Hn7vLA2po5jbkVvS16mEip9zC_Q3JiT2YvBgW8R76TtrgazSCPzbBNQeZEKF3A",
                    accessTier: "FREE"
                },
                {
                    id: 2,
                    title: "Daily Politics Briefing: South Asia Trade",
                    channel: "Politics & Affairs",
                    duration: "08:40 / 15:00",
                    progress: 58,
                    remaining: "6m left",
                    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuALERxbStfPCU07FxXjpDCOdTazljui_cozbIcV5KL6CKR9kSjX1YyI0yX5sn4NJTin-wpQzBMZGqHhGNLyZC9EEwYZ1h7T1Z18VfdEkG0u6JDocQ6Bm1BtNv8kxJCtfs-ed-auNB-RHFHNgf15tf77hbx7nJew4U_umbajJNItoQ9n42vNpoZXUqDcQ0a8J7oKDssBB_6LjzYpIh3LS9M-EqG5Gwbd5LkjLl6dmvL5iFZsvevbzlUBnQ",
                    accessTier: "PREMIUM"
                }
            ];

            this.renderContinueWatching(videos);
        } catch (error) {
            console.error('Error loading continue watching:', error);
        }
    }

    static renderVideoGrid(videos, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = videos.map(video => `
            <div class="group flex flex-col rounded-xl overflow-hidden bg-surface-container-low hover:bg-surface-container transition-all duration-300 shadow-lg hover:shadow-[0_8px_24px_rgba(99,102,241,0.2)]">
                <div class="relative aspect-video w-full overflow-hidden bg-surface-container-lowest">
                    <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="${video.thumbnail}" alt="${video.title}">
                    <div class="absolute top-2.5 left-2.5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full ${
                            video.accessTier === 'FREE'
                            ? 'bg-emerald-950/90 text-emerald-400'
                            : 'bg-gradient-to-r from-amber-500/30 to-amber-700/40 text-amber-300'
                        } font-label-sm text-label-sm font-bold tracking-wide shadow-sm backdrop-blur-md">
                            ${video.accessTier === 'PREMIUM' ? '<span class="material-symbols-outlined text-[12px]">lock</span>' : ''}
                            ${video.accessTier}
                        </span>
                    </div>
                    <div class="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/85 text-on-surface font-label-sm text-label-sm">
                        ${video.duration}
                    </div>
                    <div class="absolute inset-0 bg-surface-container-lowest/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-space-sm transition-opacity">
                        <button class="w-10 h-10 rounded-full ${video.accessTier === 'PREMIUM' ? 'bg-secondary-container text-on-secondary' : 'bg-primary text-on-primary'} flex items-center justify-center shadow-lg hover:scale-110 transition-transform" onclick="VideoLoader.playVideo(${video.id})">
                            <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                        </button>
                        <button class="w-8 h-8 rounded-full bg-surface-container-high/90 text-on-surface flex items-center justify-center shadow hover:bg-surface-container-highest transition-colors" onclick="VideoLoader.addToWatchlist(${video.id})">
                            <span class="material-symbols-outlined text-[16px]">bookmark_add</span>
                        </button>
                    </div>
                </div>
                <div class="p-space-md flex gap-space-sm">
                    <div class="flex-1 min-w-0 space-y-1">
                        <h3 class="font-headline-sm text-[15px] leading-snug text-on-surface font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                            ${video.title}
                        </h3>
                        <div class="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                            <span class="truncate">${video.channel}</span>
                            ${video.channelVerified ? '<span class="material-symbols-outlined text-primary text-[14px]">verified</span>' : ''}
                        </div>
                        <div class="flex items-center gap-space-xs font-body-sm text-body-sm text-outline">
                            <span>${video.views} views</span>
                            <span>•</span>
                            <span>${video.daysAgo}</span>
                            ${video.rating ? `<span>•</span><span class="text-amber-400 font-semibold flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">star</span>${video.rating}</span>` : ''}
                        </div>
                        <div class="flex flex-wrap items-center gap-1 pt-space-xs">
                            <span class="px-1.5 py-0.5 rounded bg-surface-container-highest text-primary font-label-sm text-[10px]">${video.category}</span>
                            ${video.tags.map(tag => `<span class="text-outline font-label-sm text-[10px]">#${tag}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    static renderContinueWatching(videos) {
        const container = document.querySelector('[data-continue-watching]');
        if (!container) return;

        container.innerHTML = videos.map(video => `
            <div class="group relative flex flex-col rounded-xl overflow-hidden bg-surface-container-low hover:bg-surface-container transition-all duration-300 shadow-md">
                <div class="relative aspect-video w-full overflow-hidden bg-surface-container-lowest">
                    <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="${video.thumbnail}" alt="${video.title}">
                    <div class="absolute top-2 left-2">
                        <span class="px-space-xs py-0.5 rounded ${
                            video.accessTier === 'FREE'
                            ? 'bg-emerald-950/80 text-emerald-400'
                            : 'bg-amber-950/80 text-amber-300'
                        } font-label-sm text-label-sm font-semibold backdrop-blur-md">
                            ${video.accessTier}
                        </span>
                    </div>
                    <div class="absolute inset-0 bg-surface-container-lowest/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div class="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <span class="material-symbols-outlined text-[24px]" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                        </div>
                    </div>
                    <div class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-on-surface font-label-sm text-label-sm">
                        ${video.remaining}
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-highest/60">
                        <div class="h-full bg-primary" style="width: ${video.progress}%;"></div>
                    </div>
                </div>
                <div class="p-space-sm flex justify-between gap-space-xs">
                    <div class="min-w-0 flex-1">
                        <h3 class="font-label-lg text-label-lg text-on-surface truncate group-hover:text-primary transition-colors">
                            ${video.title}
                        </h3>
                        <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">${video.channel} • ${video.duration}</p>
                    </div>
                    <button class="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Video Options">
                        <span class="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    static playVideo(videoId) {
        console.log('Playing video:', videoId);
        window.location.href = `/player.html?id=${videoId}`;
    }

    static addToWatchlist(videoId) {
        console.log('Added to watchlist:', videoId);
        alert('Added to watchlist!');
    }

    static init() {
        this.loadRecommendedVideos();
        this.loadContinueWatching();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    VideoLoader.init();
});
