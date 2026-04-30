import { useRef, useEffect, useState, useCallback } from "react";
import { useScroll, useSpring, useTransform, motion } from "framer-motion";

const FRAME_COUNT = 120;
const FRAME_PREFIX = '/exits_frames/ezgif-frame-';
const FRAME_SUFFIX = '.jpg';

function getFrameUrl(index: number) {
  return `${FRAME_PREFIX}${index.toString().padStart(3, '0')}${FRAME_SUFFIX}`;
}

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

function getTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const CountdownSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [loaded, setLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const targetDate = new Date("2026-05-29T07:30:00");
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(interval);
  }, []);

  const isMobile = useIsMobile();
  const framesRef = useRef<(HTMLImageElement | null)[]>(new Array(FRAME_COUNT + 1).fill(null));

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const activeProgress = useSpring(scrollYProgress, {
    stiffness: isMobile ? 150 : 50,
    damping: isMobile ? 25 : 20,
    restDelta: 0.001,
  });

  const currentFrameIndex = useTransform(
    activeProgress, 
    [0, 0.8], 
    [1, FRAME_COUNT]
  );

  // Fade in the countdown UI at the end of the scroll (when frames finish rendering)
  const uiOpacity = useTransform(activeProgress, [0.75, 0.95], [0, 1]);
  const uiY = useTransform(activeProgress, [0.75, 0.95], [50, 0]);
  const uiScale = useTransform(activeProgress, [0.75, 0.95], [0.95, 1]);

  const loadImages = useCallback(async (isCancelledRef: { current: boolean }) => {
    let loadedCount = 0;
    const mobile = window.innerWidth < 768;
    const indicesToLoad: number[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) indicesToLoad.push(i);
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
      } catch (e) {}
    };

    await fetchImage(indicesToLoad[0]);
    const priorityCount = mobile ? 60 : 30;
    const batch1 = indicesToLoad.slice(1, priorityCount).map(fetchImage);
    await Promise.all(batch1);

    if (isCancelledRef.current) return;
    setLoaded(true);

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
      framesRef.current.forEach(img => { if (img) img.src = ""; });
    };
  }, [loadImages]);

  useEffect(() => {
    if (!loaded) return;
    let animationFrameId: number;
    let lastDrawnIndex = -1;

    const render = () => {
      let index = Math.round(currentFrameIndex.get());
      index = Math.max(1, Math.min(index, FRAME_COUNT));
      while (!framesRef.current[index] && index > 1) index--;
      const img = framesRef.current[index];

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

  const units = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div
      ref={containerRef}
      className="relative bg-wedding-dark"
      style={{
        height: isMobile ? "350vh" : "400vh",
        touchAction: "pan-y",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-black">
        {!loaded && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center text-wedding-gold-light/80 backdrop-blur-md bg-black w-full h-full safe-area-pad">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-wedding-gold-light/10 border-t-wedding-gold-light/80 rounded-full animate-spin mb-4 sm:mb-6" />
            <p className="font-subtext text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.3em] font-light uppercase">
              Preparing Final Journey <span className="tabular-nums ml-1 sm:ml-2 font-mono opacity-60 text-[9px] sm:text-[10px]">{loadingProgress}%</span>
            </p>
          </div>
        )}

        <div className="absolute inset-0 z-[2] w-full h-full overflow-hidden bg-[#0a0a0a]">
          <img
            ref={imgRef}
            className={`w-full h-full object-cover object-[center_center] transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            alt="Countdown Animation"
            draggable={false}
          />
        </div>
        
        {/* Gradients to highlight UI */}
        <div className="absolute inset-0 z-[3] bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Countdown UI */}
        <motion.div
          style={{ opacity: uiOpacity, y: uiY, scale: uiScale }}
          className="absolute inset-0 z-[20] flex flex-col items-center justify-center text-center px-4 sm:px-6 safe-area-pad"
        >
          <p className="font-heading text-wedding-gold/80 text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.3em] uppercase mb-2 sm:mb-3 drop-shadow-md">Counting Down</p>
          <h2 className="font-display text-4xl sm:text-5xl md:text-7xl text-gold-gradient mb-10 sm:mb-12 md:mb-16 drop-shadow-xl">Until Forever</h2>

          <div className="flex justify-center gap-3 sm:gap-5 md:gap-8">
            {units.map((unit) => (
              <div key={unit.label} className="text-center">
                <div className="w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 rounded-lg sm:rounded-xl gold-border bg-black/60 backdrop-blur-md flex items-center justify-center mb-2 sm:mb-3 shadow-2xl">
                  <span className="font-display text-3xl sm:text-4xl md:text-5xl text-wedding-gold drop-shadow-lg">
                    {String(unit.value).padStart(2, "0")}
                  </span>
                </div>
                <span className="font-heading text-wedding-ivory/70 text-[9px] sm:text-[10px] md:text-xs tracking-[0.2em] sm:tracking-[0.25em] uppercase drop-shadow-md">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CountdownSection;
