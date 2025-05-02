import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  continueRender,
  delayRender,
  getStaticFiles,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
  watchStaticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { z } from "zod";
import SubtitlePage from "./SubtitlePage";
import { getVideoMetadata } from "@remotion/media-utils";
import { loadFont } from "../load-font";
import { NoCaptionFile } from "./NoCaptionFile";
import { TheBoldFont } from "../load-font";
import { createTikTokStyleCaptions } from "@remotion/captions";

const fontFamily = TheBoldFont

export type SubtitleProp = {
  startInSeconds: number;
  text: string;
};

export const captionedVideoSchema = z.object({
  src: z.string(),
  watermarkText: z.string().optional(),
});

export const calculateCaptionedVideoMetadata: CalculateMetadataFunction<
  z.infer<typeof captionedVideoSchema>
> = async ({ props }) => {
  const fps = 24;
  const metadata = await getVideoMetadata(props.src);

  return {
    fps,
    durationInFrames: Math.floor(metadata.durationInSeconds * fps),
  };
};

const getFileExists = (file: string) => {
  const files = getStaticFiles();
  const fileExists = files.find((f) => f.src === file);
  return Boolean(fileExists);
};

// How many captions should be displayed at a time?
const SWITCH_CAPTIONS_EVERY_MS = 1200;

// Simplified CRT Effect Component
const CRTEffect = ({ children }: { children: React.ReactNode }) => {
  // State for animation effects
  const [frame, setFrame] = useState(0);
  const [staticNoise, setStaticNoise] = useState(0.03);
  const [blackAndWhiteIntensity, setBlackAndWhiteIntensity] = useState(0);
  
  // Animation loop for frame counter
  useEffect(() => {
    let frameId: number;
    const animate = () => {
      setFrame(prev => prev + 1);
      // Random static noise variation
      if (Math.random() > 0.5) {
        setBlackAndWhiteIntensity(prev => Math.max(0, prev - 2));
        setStaticNoise(0.03 + Math.random() * 0.04);
      } else {
        setBlackAndWhiteIntensity(0)
        setStaticNoise(prev => Math.max(0.02, prev * 0.95));
      }

      // If already in B&W mode, gradually reduce its intensity or turn it off
      // if (Math.random() > 0.98) {
      //   setIsBlackAndWhite(false);
      // } else {
      //   setBlackAndWhiteIntensity(prev => Math.max(0, prev - 0.02));
      //   if (blackAndWhiteIntensity <= 0) {
      //     setIsBlackAndWhite(false);
      //   }
      // }
      
      frameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(frameId);
  }, []);
  
  // Calculate effects based on frame
  const scanLineOpacity = 0.5 + Math.abs(Math.sin(frame * 0.01) * 0.1);
  const brightness = 0.97 + Math.sin(frame * 0.02) * 0.06;
  
  // Very subtle horizontal displacement
  const horizontalShift = Math.sin(frame * 0.03) * 0.5;


  
  // Occasionally add a stronger flicker
  const flicker = Math.random() > 0.99 ? 0.7 + Math.random() * 0.3 : 1;
  
  return (
    <div className="relative w-full h-full p-8 bg-zinc-800">
      {/* CRT outer casing */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-zinc-800 to-zinc-900 overflow-hidden">
        {/* Plastic texture */}
        <div className="absolute inset-0 opacity-10 bg-noise" 
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
             }}
        />
        
        {/* Screen bezel */}
        <div className="absolute inset-10 rounded-2xl bg-black overflow-hidden shadow-inner">
          {/* CRT screen with curved edges */}
          <div className="absolute inset-2 rounded-xl overflow-hidden"
               style={{
                 boxShadow: "inset 0 0 30px 10px rgba(0, 0, 0, 0.8)",
               }}>
            
            {/* Screen content with effects */}
            <div className="relative w-full h-full overflow-hidden">
              {/* TV static/noise effect */}
              <div 
                className="absolute inset-0 pointer-events-none tv-noise-effect" 
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                  opacity: staticNoise,
                  mixBlendMode: "screen",
                }}
              />
              
              {/* Main content with very subtle effects, no rotateX tilt */}
              <div className="w-full h-full flex items-center justify-center main-container-for-video"
                   style={{ 
                     filter: `brightness(${brightness * flicker})`,
                     transform: `translateX(${horizontalShift}px)`,
                     transition: "transform 50ms ease-out",
                   }}>
                {/* Actual content */}
                <div className="w-full h-full">
                  {children}
                </div>
              </div>
              
              {/* Scan lines */}
              <div 
                className="absolute inset-0 pointer-events-none scan-lines"
                style={{
                  backgroundImage: "linear-gradient(transparent 50%, rgba(0, 0, 0, 0.4) 50%)",
                  backgroundSize: "100% 4px",
                  opacity: scanLineOpacity,
                  mixBlendMode: "multiply",
                }}
              />

             {/* Film grain overlay (more visible during B&W) */}
             {/* {isBlackAndWhite && ( */}
                <div 
                  className="absolute inset-0 pointer-events-none black-and-white" 
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    opacity: 0.1 + (blackAndWhiteIntensity * 0.1),
                    mixBlendMode: "screen",
                  }}
                />
               {/* )} */}
              
              {/* Horizontal sync issues (occasional) */}
              {Math.random() > 0.99 && (
                <div 
                  className="absolute inset-0 pointer-events-none horizontal-sync"
                  style={{
                    backgroundImage: "linear-gradient(90deg, rgba(0,255,255,0.1) 0%, transparent 20%, rgba(255,0,255,0.1) 70%, transparent 100%)",
                    transform: `translateY(${Math.random() * 100}%)`,
                    height: "3px",
                    opacity: 0.7,
                  }}
                />
              )}
              
              {/* Vignette effect */}
              <div 
                className="absolute inset-0 pointer-events-none vignette-effect"
                style={{
                  background: "radial-gradient(circle at center, transparent 60%, rgba(0, 0, 0, 0.8) 100%)",
                  opacity: 0.8,
                }}
              />
              
              {/* CRT reflections/glare */}
              <div 
                className="absolute inset-0 pointer-events-none crt-glare"
                style={{
                  background: "radial-gradient(ellipse at 70% 30%, rgba(200, 240, 255, 0.8) 0%, transparent 60%)",
                  opacity: 0.15 + Math.sin(frame * 0.01) * 0.05,
                  mixBlendMode: "screen",
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Power indicator */}
        <div className="absolute right-18 bottom-20 w-6 h-6 rounded-full bg-red-500 shadow-lg shadow-red-500/50" 
             style={{
               boxShadow: "0 0 8px 2px rgba(255, 0, 0, 0.6)",
               opacity: 0.8 + Math.sin(frame * 0.1) * 0.2,
             }}/>
      </div>
      
      {/* Power button */}
      <div className="absolute right-28 bottom-18 w-12 h-12 rounded-full bg-zinc-600 flex items-center justify-center shadow-inner">
        <div className="w-6 h-6 rounded-full bg-zinc-700 shadow-inner"></div>
      </div>
    </div>
  );
};


// Simplified Watermark
const Watermark = ({ text }: { text: string }) => {
  // const frame = useCurrentFrame();
  // const { durationInFrames } = useVideoConfig();
  
  // const opacity = Math.min(
  //   interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: 'clamp' }),
  //   interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateRight: 'clamp' })
  // );
  
  return text ? (
    <div 
      className="absolute bottom-[3rem] left-0 right-0 flex justify-center"
    >
      <div className="px-8 py-1 bg-zinc-950 bg-opacity-50 rounded-t-lg backdrop-blur-sm">
        <p className="text-white text-opacity-80 text-2xl font-normal tracking-widest" style={{
          fontFamily
        }}>
          {text}
        </p>
      </div>
    </div>
  ) : null;
};

export const CaptionedVideo = ({ src, watermarkText }: { src: string; watermarkText: string }) => {
  const [subtitles, setSubtitles] = useState([]);
  const [handle] = useState(() => delayRender());
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const subtitlesFile = src
    .replace(/.mp4$/, ".json")
    .replace(/.mkv$/, ".json")
    .replace(/.mov$/, ".json")
    .replace(/.webm$/, ".json");

  const fetchSubtitles = useCallback(async () => {
    try {
      await loadFont();
      const res = await fetch(subtitlesFile);
      if (!res.ok) {
        setSubtitles([]);
      } else {
        const data = await res.json();
        setSubtitles(data);
      }
    } catch (e) {
      setSubtitles([]);
    } finally {
      continueRender(handle);
    }
  }, [handle, subtitlesFile]);

  useEffect(() => {
    fetchSubtitles();
    const c = watchStaticFile(subtitlesFile, fetchSubtitles);
    return () => c.cancel();
  }, [fetchSubtitles, subtitlesFile]);

  const { pages } = useMemo(() => {
    return createTikTokStyleCaptions({
      combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
      captions: subtitles ?? [],
    });
  }, [subtitles]);

  // Simplified subtle scale animation
  const scale = interpolate(
    Math.sin(frame * 0.01),
    [-1, 1],
    [0.995, 1.005]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <CRTEffect>
      <AbsoluteFill className="flex items-center justify-center">
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: `scale(${scale})`,
              transition: "transform 0.5s ease-in-out",
            }}
          >
            <OffthreadVideo
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              src={src}
            />
          </div>
        </AbsoluteFill>
        
        {getFileExists(subtitlesFile) ? null : <NoCaptionFile />}
      </CRTEffect>

      {watermarkText && <Watermark text={watermarkText} />}

      {/* Captions */}
      {pages.map((page, index) => {
          const nextPage = pages[index + 1] ?? null;
          const subtitleStartFrame = (page.startMs / 1000) * fps;
          const subtitleEndFrame = Math.min(
            nextPage ? (nextPage.startMs / 1000) * fps : Infinity,
            subtitleStartFrame + (SWITCH_CAPTIONS_EVERY_MS / 1000) * fps,
          );
          const durationInFrames = subtitleEndFrame - subtitleStartFrame;
          if (durationInFrames <= 0) {
            return null;
          }

          return (
            <Sequence
              key={index}
              from={subtitleStartFrame}
              durationInFrames={durationInFrames}
            >
              <SubtitlePage key={index} page={page} />
            </Sequence>
          );
        })}
    </AbsoluteFill>
  );
};