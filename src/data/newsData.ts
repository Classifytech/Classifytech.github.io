export interface TechArticle {
  id: string;
  badge: string;
  category: 'ALL' | 'CHINA' | 'GLOBAL' | 'INDIA' | 'CHIPSET' | 'GAMING' | '5G' | 'BATTERY';
  time: string;
  sourceName?: string;
  sourceUrl?: string;
  title: string;
  desc: string;
  img: string;
  fullBody: string[];
  bullets?: string[];
  hashtags?: string[];
  isVideo?: boolean;
  videoUrl?: string;
  isHero?: boolean;
  publishedAtMs: number;
  channelName?: string;
  trendSource?: 'Google Trends' | 'X Tech Wire' | 'YouTube Tech' | 'Brand Showcase';
  trendVelocity?: string;
}

export const formatCleanCategoryBadge = (article: Pick<TechArticle, 'category'>): string => {
  switch (article.category) {
    case 'CHIPSET':
      return 'SILICON & AI';
    case 'CHINA':
      return 'CHINA LAUNCH';
    case 'GLOBAL':
      return 'GLOBAL TECH';
    case 'INDIA':
      return 'INDIA LAUNCH';
    case 'GAMING':
      return 'GAMING & FPS';
    case 'BATTERY':
      return 'BATTERY TECH';
    case '5G':
      return '5G & WIRELESS';
    default:
      return 'TECH NEWS';
  }
};

const rawDefaultTechArticles: Omit<TechArticle, 'publishedAtMs'>[] = [
  {
    id: 'tsmc-3nm-n3e-snapdragon-dimensity-breakout',
    badge: 'SILICON & AI',
    category: 'CHIPSET',
    time: '1 hour ago',
    sourceName: 'The Verge',
    sourceUrl: 'https://www.theverge.com/tech',
    isHero: true,
    trendSource: 'Google Trends',
    trendVelocity: 'Top Silicon Story',
    hashtags: ['#Snapdragon8Elite', '#AIUpdates', '#ChinaFlagships'],
    title: 'Snapdragon 8 Elite & Dimensity 9400 Shatter 3nm Efficiency Benchmarks in Sustained 120FPS Workloads',
    desc: 'Independent semiconductor telemetry confirms second-generation TSMC N3E flagship processors cut sustained GPU power draw by 38% while crossing 2.89M on AnTuTu v10.',
    img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'The mobile semiconductor industry has crossed a major inflection point as second-generation 3nm (TSMC N3E) processors enter mass retail hardware. Independent lab testing of Qualcomm’s custom Oryon-core Snapdragon 8 Elite and MediaTek’s All-Big-Core Dimensity 9400 reveals a generational leap in performance-per-watt under continuous 60-minute load.',
      'By migrating from legacy FinFET profiles to denser N3E transistor libraries and wider L2/L3 cache hierarchies, both chipsets sustain peak clock frequencies above 4.3GHz without triggering steep thermal throttling steps. Across back-to-back 3DMark Wildlife Extreme loops, frame-rate stability remains above 93% when paired with dual-loop vapor chambers.',
      'Qualcomm’s sliced Adreno 830 GPU architecture and MediaTek’s 12-core Immortalis-G925 also bring desktop-class hardware ray tracing and opacity micromap acceleration to mobile displays, holding locked 120FPS frame times while reducing battery temperatures by up to 4.2°C.',
      'Crucially, integrated Neural Processing Units (NPUs) now exceed 48 TOPS of INT4/INT8 compute, enabling multimodal on-device language and vision models to run locally in unified LPDDR5X memory with sub-millisecond latency.'
    ],
    bullets: [
      'TSMC N3E 3nm node cuts sustained GPU wattage by up to 38% at 120FPS.',
      'AnTuTu v10 multi-core scores surpass 2.89 Million with <8% thermal variance.',
      'Dedicated 48+ TOPS NPU accelerates local multimodal AI without cloud latency.'
    ]
  },
  {
    id: 'mkbhd-reviews-galaxy-s25-ultra-editorial',
    badge: 'YOUTUBE REVIEW',
    category: 'GLOBAL',
    time: '2 hours ago',
    sourceName: 'Marques Brownlee (MKBHD)',
    sourceUrl: 'https://www.youtube.com/@mkbhd',
    isVideo: true,
    videoUrl: 'https://www.youtube.com/@mkbhd',
    channelName: 'Marques Brownlee (MKBHD)',
    trendSource: 'YouTube Tech',
    trendVelocity: '1.9M Views · Trending',
    hashtags: ['#Snapdragon8Elite', '#AIUpdates'],
    title: 'Marques Brownlee (MKBHD) Reveals Samsung Galaxy S25 Ultra Key Highlights & Hidden Features',
    desc: 'Marques Brownlee posted an in-depth review of the Samsung Galaxy S25 Ultra, highlighting its 4.47GHz Snapdragon 8 Elite chip, Grade 5 Titanium ergonomics, Gorilla Armor 2 anti-reflective glass, and Galaxy AI upgrades.',
    img: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'In his latest flagship hardware review on YouTube, Marques Brownlee (MKBHD) put the Samsung Galaxy S25 Ultra through extensive daily-driver testing to evaluate whether Samsung’s ergonomic and silicon refinements justify its flagship crown.',
      'The standout feature underscored in the review is Corning Gorilla Armor 2 paired with the 6.86-inch QHD+ Dynamic AMOLED 2X panel, which eliminates up to 75% of ambient surface reflections and makes outdoor legibility noticeably superior to competing glass flagships.',
      'Under the hood, the custom 4.47GHz Snapdragon 8 Elite for Galaxy processor and a 40% larger vapor chamber deliver instant shutter response, smooth 4K 120FPS ProVisual log recording, on-device multimodal AI agents, and 7 years of promised OS updates.'
    ],
    bullets: [
      'Gorilla Armor 2 anti-reflective coating cuts outdoor glare by 75%.',
      'Custom 4.47GHz Snapdragon 8 Elite for Galaxy across all global markets.',
      'Lighter Grade 5 Titanium chassis with rounded corners and 7-year OS support.'
    ]
  },
  {
    id: 'ice-universe-dcs-periscope-battery-leak',
    badge: 'X TIPSTER SCOOP',
    category: 'CHINA',
    time: '3 hours ago',
    sourceName: 'Ice Universe & Digital Chat Station (X)',
    sourceUrl: 'https://x.com/UniverseIce',
    trendSource: 'X Tech Wire',
    trendVelocity: '42.8K Posts · Viral Leak',
    hashtags: ['#ChinaFlagships', '#Snapdragon8Elite'],
    title: 'Ice Universe & Digital Chat Station Reveal 200MP Periscope & 7,500mAh Si/C Flagship Key Highlights & Hidden Features',
    desc: 'Top hardware tipsters Ice Universe (@UniverseIce) and Digital Chat Station revealed next-gen 200MP 1/1.4-inch continuous periscope optics and 7,500mAh single-cell Silicon-Carbon batteries entering mass production.',
    img: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'Verified X (Twitter) hardware tipsters Ice Universe (@UniverseIce) and Digital Chat Station have published back-to-back supply-chain scoops detailing the next wave of Chinese and global Ultra flagships.',
      'According to Ice Universe, prototype Ultra handsets are now testing a 200MP 1/1.4-inch ISOCELL telephoto sensor paired with dual-floating periscope lens groups, enabling continuous 3.5x to 8.5x optical zoom without digital crop.',
      'Simultaneously, Digital Chat Station confirmed that second-generation high-density Silicon-Carbon (Si/C) anode cells reaching 840 Wh/L volumetric density have entered mass production, allowing 7,500mAh capacities + 120W PPS charging inside sleek 8.1mm smartphone frames.'
    ],
    bullets: [
      '200MP 1/1.4-inch periscope sensor with continuous 3.5x–8.5x optical zoom.',
      '7,500mAh Silicon-Carbon anode battery fits inside sub-8.1mm smartphone frames.',
      'Supports 100W UFCS / 120W wired PPS charging with 1,600+ cycle longevity.'
    ]
  },
  {
    id: 'classify-tech-3nm-thermals-youtube-review',
    badge: 'YOUTUBE LAB TEST',
    category: 'GAMING',
    time: '4 hours ago',
    sourceName: 'CLASSIFY TECH YouTube',
    sourceUrl: 'https://www.youtube.com/channel/UCp0jHiCTqxDYZ0Bi0sKUmbw',
    isVideo: true,
    videoUrl: 'https://www.youtube.com/channel/UCp0jHiCTqxDYZ0Bi0sKUmbw',
    channelName: 'CLASSIFY TECH',
    trendSource: 'YouTube Tech',
    trendVelocity: 'Trending Hardware Benchmark',
    hashtags: ['#Snapdragon8Elite', '#ChinaFlagships'],
    title: 'CLASSIFY TECH Reveals Snapdragon 8 Elite vs Dimensity 9400 Gaming Thermals: Key Highlights & Hidden Features',
    desc: 'Published on the official CLASSIFY TECH YouTube channel, this side-by-side hardware stress test compares 120FPS frame pacing, vapor-chamber surface temperatures, and battery drain across the newest 3nm flagships.',
    img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'The official CLASSIFY TECH hardware lab published a head-to-head video benchmark testing Qualcomm’s Snapdragon 8 Elite against MediaTek’s Dimensity 9400 across 60 minutes of continuous 120FPS gaming and 4K60 video rendering.',
      'Telemetry captured with FLIR thermal imaging shows that devices equipped with 6,000mm²+ dual-loop stainless steel vapor chambers maintain 94.2% frame-time stability while keeping peak chassis temperatures below 41.5°C.',
      'Bypass charging (direct motherboard power routing) proved to be a standout gaming feature, cutting battery heat generation by up to 4.5°C during plugged-in esports sessions.'
    ],
    bullets: [
      '94.2% 120FPS frame stability across 60-minute continuous stress loops.',
      'Dual-loop vapor chambers keep chassis temperatures under 41.5°C.',
      'Bypass charging protects battery health during competitive gaming.'
    ]
  },
  {
    id: 'gurman-kuo-2nm-silicon-supply-chain-scoop',
    badge: 'IPHONE 18 & 2NM LEAK',
    category: 'CHIPSET',
    time: '5 hours ago',
    sourceName: 'Mark Gurman & Ming-Chi Kuo',
    sourceUrl: 'https://arstechnica.com/gadgets/',
    trendSource: 'X Tech Wire',
    trendVelocity: '31.5K Posts · Trending',
    hashtags: ['#iPhone18Leak', '#AIUpdates'],
    title: 'Mark Gurman & Ming-Chi Kuo Reveal iPhone 18 Pro 2nm A20 Chip & Variable Aperture Camera: Key Highlights & Hidden Features',
    desc: 'Supply-chain analysts Mark Gurman and Ming-Chi Kuo reveal Apple’s roadmap for TSMC 2nm Gate-All-Around (GAA) A20 processors, 12GB unified LPDDR6 memory, and variable-aperture tetraprism cameras.',
    img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'Industry analysts Mark Gurman (@markgurman) and Ming-Chi Kuo (@mingchikuo) have shared detailed semiconductor foundry and optical supply-chain notes covering the transition from 3nm FinFET to 2nm Gate-All-Around (GAA) nanosheet transistors for future iPhone Pro hardware.',
      'According to Kuo’s latest foundry survey, TSMC’s 2nm process node delivers a 15% speed improvement at the same power or a 30% power reduction at the same clock speed, paired with unified high-bandwidth memory packaging for on-device Apple Intelligence.',
      'On the optical front, variable-aperture main lenses and upgraded 1/1.3-inch tetraprism telephoto modules with f/2.2 optics are entering supply-chain allocation to dramatically boost low-light zoom.'
    ],
    bullets: [
      'TSMC 2nm GAA nanosheet transistors cut power draw by up to 30%.',
      'Next-gen Neural Engine designed for sub-3.5W on-device multimodal AI.',
      'Variable-aperture main camera + 1/1.3-inch tetraprism telephoto upgrade.'
    ]
  },
  {
    id: 'xiaomi-15-pro-china-launch',
    badge: 'CHINA & GLOBAL LAUNCH',
    category: 'CHINA',
    time: '6 hours ago',
    sourceName: 'GSMArena',
    sourceUrl: 'https://www.gsmarena.com',
    trendSource: 'Google Trends',
    trendVelocity: '+340% Search Breakout',
    hashtags: ['#ChinaFlagships', '#HyperOS2', '#Snapdragon8Elite'],
    title: 'Xiaomi 15 Pro & 15 Ultra Reveal 6,100mAh Silicon Batteries, HyperOS 2.0 & Leica 5x Periscope: Key Highlights & Hidden Features',
    desc: 'Ultrasonic 3D biometrics, HyperOS 2.0 kernel scheduling, 3,200-nit M9 LTPO OLED panels, and 5x lossless periscope telemacro lenses headline Xiaomi’s latest flagship generation.',
    img: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'Xiaomi’s 15-series flagship lineup demonstrates how high-density battery chemistry, HyperOS 2.0 micro-architecture tuning, and custom M9 luminous OLED materials can dramatically extend multi-day endurance on 2K displays.',
      'The Xiaomi 15 Pro houses a 6,100mAh Silicon-Carbon battery inside an 8.35mm frame weighing 213 grams, driving a micro-quad-curved 1–120Hz LTPO panel that reaches 3,200 nits peak brightness while consuming 24% less power.',
      'Co-engineered with Leica, the triple 50MP Summilux optical array combines a Light Fusion 900 main sensor with an IMX858 5x periscope telephoto capable of 10x lossless zoom and 30cm telemacro focusing.'
    ],
    bullets: [
      '6,100mAh Silicon-Carbon cell inside an 8.35mm micro-curved chassis.',
      'Custom M9 2K LTPO OLED display cuts panel power draw by 24%.',
      'HyperOS 2.0 kernel scheduler + Leica Summilux 5x periscope telephoto.'
    ]
  },
  {
    id: 'hyperos-india-rollout',
    badge: 'HYPEROS 2 & AI',
    category: 'INDIA',
    time: '7 hours ago',
    sourceName: '9to5Google',
    sourceUrl: 'https://9to5google.com',
    trendSource: 'Google Trends',
    trendVelocity: '+290% Search Interest',
    hashtags: ['#HyperOS2', '#AIUpdates'],
    title: 'HyperOS 2.0, OxygenOS 15 & One UI 7 Reveal AI Kernel Scheduling: Key Highlights & Hidden Features',
    desc: 'Heterogeneous CPU thread scheduling, dynamic memory compaction, and local NPU voice/vision agents deliver 32% faster app launches and locked 120Hz UI animations.',
    img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'Modern Android 15 operating system builds—led by HyperOS 2.0, OxygenOS 15, and One UI 7—have shifted focus from surface cosmetics to low-level Linux kernel thread scheduling and render-pipeline prioritization.',
      'By assigning real-time interrupt priority to touch-input and compositor threads while dynamically compacting background LPDDR5X memory pages, cold app launch latency drops by up to 32% on UFS 4.0 devices.',
      'System-level AI inference hooks also run directly on the NPU for live bilingual audio transcription, semantic gallery search, and document summarization without cloud round-trips.'
    ],
    bullets: [
      'HyperOS 2.0 kernel compositor prioritization eliminates 120Hz frame drops.',
      'Up to 32% faster cold app launches on UFS 4.0 storage.',
      'Local NPU scheduling for offline voice transcription and AI image tools.'
    ]
  },
  {
    id: 'mrwhosetheboss-dave2d-battery-review',
    badge: 'YOUTUBE COMPARISON',
    category: 'BATTERY',
    time: '8 hours ago',
    sourceName: 'Mrwhosetheboss & Dave2D',
    sourceUrl: 'https://www.youtube.com/@Mrwhosetheboss',
    isVideo: true,
    videoUrl: 'https://www.youtube.com/@Mrwhosetheboss',
    channelName: 'Mrwhosetheboss',
    trendSource: 'YouTube Tech',
    trendVelocity: '1.4M Views · Last 12h',
    hashtags: ['#ChinaFlagships', '#Snapdragon8Elite'],
    title: 'Mrwhosetheboss & Dave2D Reveal 6,500mAh Silicon-Carbon Battery Champions: Key Highlights & Hidden Features',
    desc: 'Arun Maini (Mrwhosetheboss) and Dave Lee (Dave2D) ran continuous screen-on battery drain tests showing 6,000mAh+ Silicon-Carbon flagships beating 5,000mAh phones by over 3.5 hours.',
    img: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'In a comprehensive battery endurance drain test on YouTube, Mrwhosetheboss and Dave2D compared the latest generation of Silicon-Carbon (Si/C) flagship smartphones against traditional 5,000mAh Li-Ion competitors.',
      'Because nano-silicon carbon anodes store significantly more lithium ions per cubic millimeter than standard graphite, compact handsets like the 6.31-inch Vivo X200 Pro Mini (5,700mAh) and full-size flagships like the OnePlus 13 (6,000mAh) achieved 11 to 13.5 hours of continuous active screen time.',
      'Both creators highlighted that 80W–120W fast charging restores 100% capacity in under 32 minutes while maintaining cool battery temperatures.'
    ],
    bullets: [
      '6,000mAh+ Silicon-Carbon phones last up to 3.5 hours longer in active drain tests.',
      'Compact 6.3-inch flagships now fit 5,700mAh batteries at just 187 grams.',
      'Full 1–100% fast charge completes in 28 to 35 minutes.'
    ]
  },
  {
    id: 'sony-lytia-brand-showcase-announcement',
    badge: 'OFFICIAL BRAND SHOWCASE',
    category: 'INDIA',
    time: '9 hours ago',
    sourceName: 'Android Authority',
    sourceUrl: 'https://www.androidauthority.com',
    trendSource: 'Brand Showcase',
    trendVelocity: 'Trending Optical Reveal',
    hashtags: ['#ChinaFlagships', '#AIUpdates'],
    title: 'Official Brand Showcase Reveals Sony LYTIA 2-Layer Stacked Sensors & Zeiss APO Periscopes: Key Highlights & Hidden Features',
    desc: 'Official optical announcements across Instagram, Facebook, and launch keynotes reveal how Sony LYT-900 and LYT-818 2-layer stacked sensors double light capture and eliminate night shadow noise.',
    img: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'Official flagship camera showcases from Sony Semiconductor, Vivo, Oppo, and Xiaomi have spotlighted the rapid adoption of 2-layer transistor pixel stacked CMOS sensors—led by the 1-inch LYT-900 and 1/1.28-inch LYT-818.',
      'By separating photodiodes and pixel transistors onto two stacked silicon wafers, full-well photon saturation capacity nearly doubles, allowing slimmer 1/1.28-inch sensors to rival legacy 1-inch cameras in low-light dynamic range.',
      'Combined with Zeiss T* apochromatic (APO) periscope prisms and Hasselblad natural color calibration, 2026 flagships capture 14-stop RAW portraits and 4K 120FPS Dolby Vision video with zero shutter lag.'
    ],
    bullets: [
      '2-layer transistor pixel stacking doubles photon saturation capacity.',
      'Delivers 14-stop native HDR dynamic range with zero highlight clipping.',
      'Pairs with Zeiss APO and Hasselblad periscope optics for lossless 3x–10x zoom.'
    ]
  },
  {
    id: 'wifi-7-india-spectrum-evolution',
    badge: 'WIRELESS & 5G',
    category: '5G',
    time: '10 hours ago',
    sourceName: 'The Verge',
    sourceUrl: 'https://www.theverge.com/tech',
    trendSource: 'Google Trends',
    trendVelocity: '+240% Rising Topic',
    hashtags: ['#Snapdragon8Elite', '#AIUpdates'],
    title: 'Wi-Fi 7 (802.11be) Architecture Explained: Multi-Link Operation (MLO), 320MHz Channels & 4K-QAM',
    desc: 'How simultaneous multi-band packet aggregation across 2.4GHz, 5GHz, and 6GHz slashes wireless latency below 4ms and pushes mobile throughput past 5.8Gbps.',
    img: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'Wi-Fi 7 (IEEE 802.11be Extremely High Throughput) is rapidly becoming the standard wireless interconnect across flagship smartphones, laptops, and mesh routers.',
      'Its defining architectural breakthrough is Multi-Link Operation (MLO). Rather than locking a handset to a single 5GHz or 6GHz radio channel, MLO aggregates and switches packets across multiple frequency bands simultaneously, cutting wireless jitter and packet loss by over 90%.',
      'Combined with ultra-wide 320MHz channels and 4096-QAM (4K-QAM) modulation—which packs 20% more data bits per symbol than Wi-Fi 6E—modern 2x2 MIMO smartphone radios achieve up to 5.8Gbps peak link rates.'
    ],
    bullets: [
      'Multi-Link Operation (MLO) bonds 5GHz and 6GHz bands for <4ms latency.',
      '4096-QAM modulation boosts raw symbol density by 20% over Wi-Fi 6E.',
      'Up to 5.8Gbps throughput on 2x2 MIMO mobile transceivers.'
    ]
  },
  {
    id: 'evan-blass-foldable-hinge-cad-leak',
    badge: 'FOLDABLE HARDWARE',
    category: 'GLOBAL',
    time: '11 hours ago',
    sourceName: 'Evan Blass (@evleaks) & GSMArena',
    sourceUrl: 'https://www.gsmarena.com',
    trendSource: 'X Tech Wire',
    trendVelocity: '24.1K Posts · 12h',
    hashtags: ['#ChinaFlagships', '#iPhone18Leak'],
    title: 'Evan Blass CAD Leak Reveals Sub-8.9mm Titanium Waterdrop Foldable Key Highlights & Hidden Features',
    desc: 'Press CAD schematics shared by Evan Blass (@evleaks) confirm book-style foldables have broken the 8.9mm folded barrier using Grade 5 Titanium waterdrop hinges and carbon-fiber backplates.',
    img: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1200&q=80',
    fullBody: [
      'Book-style foldable smartphones have shed the bulk and deep display creases of early generations through advances in metallurgy and hinge kinematics, as highlighted in press CAD schematics leaked by Evan Blass (@evleaks).',
      'By replacing 100+ steel gear assemblies with 40-component Grade 5 Titanium waterdrop hinges and aerospace carbon-fiber display backplates, folded thickness has dropped below 8.9mm (4.2mm unfolded)—virtually indistinguishable from a standard glass slab flagship.',
      'Third-party lab certifications now validate modern ultra-thin glass (UTG) folding panels for over 500,000 fold cycles alongside IPX8 + IP6X water and dust resistance.'
    ],
    bullets: [
      '8.9mm folded / 4.2mm unfolded thickness matches standard slab flagships.',
      'Grade 5 Titanium waterdrop hinges cut internal part count by 60%.',
      'Certified for 500,000+ fold cycles with IPX8 water protection.'
    ]
  }
];

export const defaultTechArticles: TechArticle[] = rawDefaultTechArticles.map((art, idx) => ({
  ...art,
  isHero: false,
  publishedAtMs: Date.now() - (7 * 24 + idx) * 3600 * 1000,
}));

