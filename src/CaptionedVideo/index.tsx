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
import { createTikTokStyleCaptions } from "@remotion/captions";

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
  const frame = useCurrentFrame();
  
  // Combine effects into a single div with CSS
  return (
    <div 
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{
        background: "#1f1f1f",
        boxShadow: "0 0 30px rgba(0, 0, 0, 0.5), inset 0 0 20px 4px rgba(255, 255, 255, 0.1)",
      }}
    >
      {/* Content area with combined effects */}
      <div 
        className="absolute inset-8 rounded-[40px] overflow-hidden"
        style={{
          background: "#0a0a0a",
          filter: `brightness(${interpolate(Math.sin(frame * 0.2), [-1, 1], [0.97, 1.03])})`,
        }}
      >
        {/* Main content */}
        <div className="w-full h-full relative">
          {children}
            
          {/* Combined overlay for scan lines and glare */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(transparent 50%, rgba(0, 0, 0, 0.4) 50%)",
              backgroundSize: "100% 4px",
              opacity: 0.5,
              mixBlendMode: "overlay",
              background: "radial-gradient(circle at 70% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 60%)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Simplified Watermark
const Watermark = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  
  const opacity = Math.min(
    interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: 'clamp' }),
    interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateRight: 'clamp' })
  );
  
  return text ? (
    <div 
      className="absolute bottom-8 left-0 right-0 flex justify-center"
      style={{ opacity }}
    >
      <div className="px-4 py-2 bg-black bg-opacity-50 rounded-lg backdrop-blur-sm">
        <p className="text-white text-opacity-80 text-xl font-medium tracking-wider">
          {text || "@thesleebit"}
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
        <div style={{ transform: `scale(${scale})`, width: "100%", height: "100%" }}>
          <OffthreadVideo
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            src={src}
          />
        </div>
        
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
        
        {getFileExists(subtitlesFile) ? null : <NoCaptionFile />}
        {watermarkText && <Watermark text={watermarkText} />}
      </CRTEffect>
    </AbsoluteFill>
  );
};