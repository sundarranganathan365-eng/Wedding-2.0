import { useRef, useEffect, useState, useCallback } from "react";
import { useScroll, useSpring, useTransform, motion } from "framer-motion";

const FRAME_COUNT = 92;
const FRAME_PREFIX = '/new_frames_1/ezgif-frame-';
const FRAME_SUFFIX = '.jpg';

function getFrameUrl(index: number) {
  return `${FRAME_PREFIX}${index.toString().padStart(3, '0')}${FRAME_SUFFIX}`;
}

/** Reactive viewport hook — responds to resize + orientation changes */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [breakpoint]);

  return isMobile;
}

const HeroSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [loaded, setLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const isMobile = useIsMobile();

  // Reference for holding preloaded image elements natively (Mobile Safari memory optimized)
  const framesRef = useRef<(HTMLImageElement | null)[]>(new Array(FRAME_COUNT + 1).fill(null));

  // Framer Motion Scroll tracking
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // NATIVE SCROLL FIX: To avoid Framer Motion useTransform hook crashes from ternary motion-value swaps,
  // we use a unified spring but make it virtually instant (1:1 tracking) on mobile, and smooth/cinematic on desktop.
  const activeProgress = useSpring(scrollYProgress, {
    stiffness: isMobile ? 150 : 50,
    damping: isMobile ? 25 : 20,
    restDelta: 0.001,
  });

  // Story Mapping interpolation: Mapping scroll uniformly for smooth sequence playback
  const currentFrameIndex = useTransform(
    activeProgress, 
    [0, 0.2, 0.6, 0.85, 1], 
    [1, 18, 55, 83, FRAME_COUNT]
  );

  // Typographic Opacity maps for the cinematic title (fades out as you scroll)
  const titleOpacity = useTransform(activeProgress, [0, 0.15, 0.25], [1, 0.5, 0]);
  const titleScale = useTransform(activeProgress, [0, 0.25], [1, 0.95]);
  const titleY = useTransform(activeProgress, [0, 0.25], ["0%", "-30%"]);

  // Cinematic story layers removed

  const loadImages = useCallback(async (isCancelledRef: { current: boolean }) => {
    let loadedCount = 0;
    const mobile = window.innerWidth < 768;
    
    // Load all frames to ensure 60fps visual smoothness without frame-skipping chop
    const indicesToLoad: number[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      indicesToLoad.push(i);
    }
    const totalToLoad = indicesToLoad.length;

    const fetchImage = async (idx: number) => {
      try {
        const img = new Image();
        img.src = getFrameUrl(idx);
        await new Promise((resolve) => {
          img.onload = () => {
            if (!isCancelledRef.current) {
              framesRef.current[idx] = img;
              loadedCount++;
              setLoadingProgress(Math.round((loadedCount / totalToLoad) * 100));
            }
            resolve(true);
          };
          img.onerror = () => resolve(false);
        });
      } catch (e) {
        console.warn(`Failed to preload frame ${idx}`, e);
      }
    };

    // 1. Force fetch absolutely crucial first frame sequentially
    await fetchImage(indicesToLoad[0]);

    // 2. Priority Batch: Network fetch lag freezes the frame. 
    // We force mobile to cache 50% of the sequence heavily before unlocking UI to guarantee 0% network shudder.
    const priorityCount = mobile ? 60 : 30;
    const batch1 = indicesToLoad.slice(1, priorityCount).map(fetchImage);
    await Promise.all(batch1);

    if (isCancelledRef.current) return;
    setLoaded(true);

    // 3. Lazy Async fetch the remaining in micro-chunks to keep CPU/Network breathable
    const chunkSize = mobile ? 5 : 10;
    for (let i = priorityCount; i < indicesToLoad.length; i += chunkSize) {
      if (isCancelledRef.current) break;
      const chunk = indicesToLoad.slice(i, i + chunkSize).map(fetchImage);
      await Promise.all(chunk);
    }
  }, []);

  useEffect(() => {
    const isCancelledRef = { current: false };
    loadImages(isCancelledRef);

    return () => {
      isCancelledRef.current = true;
      framesRef.current.forEach(img => {
        if (img) img.src = "";
      });
    };
  }, [loadImages]);

  // Frame Renderer syncing native image compositor to scroll state
  useEffect(() => {
    if (!loaded) return;

    let animationFrameId: number;
    let lastDrawnIndex = -1;

    const render = () => {
      let index = Math.round(currentFrameIndex.get());
      index = Math.max(1, Math.min(index, FRAME_COUNT));

      // Display most recent cached frame if scanning too fast
      while (!framesRef.current[index] && index > 1) {
        index--;
      }

      const img = framesRef.current[index];

      // FATAL MOBILE LAG FIX: Using native <img> compositor instead of heavy Canvas drawImage.
      // Modifying the `src` property routes directly through the CSS GPU pipeline (0% CPU cost).
      if (img && imgRef.current) {
        if (lastDrawnIndex !== index) {
          imgRef.current.src = img.src;
          lastDrawnIndex = index;
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [loaded, currentFrameIndex]);

  return (
    <div
      ref={containerRef}
      className={`relative bg-wedding-dark`}
      style={{
        height: isMobile ? "400vh" : "500vh", // Increased mobile height for slower, smoother frame parsing
        touchAction: "pan-y",            /* Prevent horizontal swipe interference on mobile */
        WebkitOverflowScrolling: "touch", /* iOS momentum scrolling */
      }}
    >
      {/* Sticky wrapper */}
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden hero-gradient bg-black">
        
        {/* Preloader Phase */}
        {!loaded && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center text-wedding-gold-light/80 backdrop-blur-md bg-black w-full h-full safe-area-pad">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-wedding-gold-light/10 border-t-wedding-gold-light/80 rounded-full animate-spin mb-4 sm:mb-6" />
            <p className="font-subtext text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] font-light uppercase">
              Preparing the Journey <span className="tabular-nums ml-1 sm:ml-2 font-mono opacity-60 text-[9px] sm:text-[10px]">{loadingProgress}%</span>
            </p>
          </div>
        )}

        <div className="absolute inset-0 z-[2] w-full h-full overflow-hidden bg-[#0a0a0a]">
          <img
            ref={imgRef}
            className={`w-full h-full object-cover object-center transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            alt="Cinematic Scroll Reveal"
            draggable={false}
          />
        </div>

        {/* Night Gradients to blend UI */}
        <div className="absolute inset-0 z-[3] bg-gradient-to-t from-wedding-dark/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 z-[3] bg-gradient-to-b from-black/20 via-transparent to-transparent pointer-events-none" />

        {/* The Initial Main Content / Typography */}
        <motion.div
          style={{ opacity: titleOpacity, scale: titleScale, y: titleY }}
          className="relative z-[20] flex flex-col items-center justify-center h-full text-center px-4 sm:px-6 safe-area-pad"
        >
          {/* Tamil blessing */}
          <p className="font-tamil text-wedding-gold-light/90 text-[10px] sm:text-xs md:text-sm lg:text-lg mb-2 sm:mb-3 md:mb-4 tracking-wider sm:tracking-widest drop-shadow-md leading-relaxed">
            ॐ श्री गणेशाय नमः
          </p>

          <div className="flex items-center gap-3 sm:gap-4 md:gap-6 mb-3 sm:mb-4 md:mb-8 opacity-60">
            <div className="w-6 sm:w-8 md:w-12 h-[1px] bg-wedding-gold-light" />
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-wedding-gold-light" />
            <div className="w-6 sm:w-8 md:w-12 h-[1px] bg-wedding-gold-light" />
          </div>

          <div className="flex flex-col gap-0.5 sm:gap-1 md:gap-4 mb-3 sm:mb-4 md:mb-8">
            <h1 className="font-display text-3xl sm:text-4xl md:text-7xl lg:text-8xl xl:text-9xl text-wedding-gold-light drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] uppercase leading-tight">
              The Bride
            </h1>
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <span className="font-heading text-wedding-gold-light/60 text-xs sm:text-sm md:text-xl tracking-[0.3em] sm:tracking-[0.5em] uppercase">Weds</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-7xl lg:text-8xl xl:text-9xl text-wedding-gold-light drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] uppercase leading-tight">
              The Groom
            </h1>
          </div>

          <div className="mt-1 sm:mt-2 md:mt-4 px-4 sm:px-6 md:px-8 py-1.5 sm:py-2 md:py-3 border-y border-wedding-gold-light/20 bg-black/40 backdrop-blur-md">
            <p className="font-subtext text-wedding-ivory text-sm sm:text-base md:text-lg lg:text-2xl tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em]">
              29 . 05 . 2026
            </p>
          </div>
          
          {/* Scroll Hint */}
          <div className="absolute -bottom-20 sm:-bottom-28 md:-bottom-32 flex flex-col items-center gap-1.5 sm:gap-2">
            <span className="font-subtext text-wedding-gold-light/40 text-[8px] sm:text-[9px] md:text-[10px] tracking-[0.3em] sm:tracking-[0.4em] uppercase">Scroll to Reveal</span>
            <div className="w-[1px] h-6 sm:h-8 md:h-10 bg-gradient-to-b from-wedding-gold-light/40 to-transparent animate-pulse" />
          </div>
        </motion.div>

        {/* Scrollytelling Layers removed */}
      </div>
    </div>
  );
};

export default HeroSection;
