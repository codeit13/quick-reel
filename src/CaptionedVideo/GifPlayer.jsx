import React, { useEffect, useRef, useState } from 'react';
import SuperGif from './SuperGif';

// interface GifPlayerProps {
//   src: string;
//   width?: number;
//   height?: number;
//   autoPlay?: boolean;
//   loop?: boolean;
//   loopDelay?: number;
//   onLoad?: () => void;
//   onEnd?: () => void;
//   showProgressBar?: boolean;
//   progressBarHeight?: number;
//   progressBarBackgroundColor?: string;
//   progressBarForegroundColor?: string;
//   className?: string;
//   style?: React.CSSProperties;
// }

const GifPlayer = ({
  src,
  width,
  height,
  autoPlay = true,
  loop = true,
  loopDelay = 0,
  onLoad,
  onEnd,
  showProgressBar = true,
  progressBarHeight = 5,
  progressBarBackgroundColor = 'rgba(255,255,255,0.4)',
  progressBarForegroundColor = 'rgba(255,0,22,.8)',
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [gifController, setGifController] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !imgRef.current) return;

    // Clean up previous instance if it exists
    const container = containerRef.current;
    if (container.firstChild && container.firstChild !== imgRef.current) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      container.appendChild(imgRef.current);
    }

    // Initialize SuperGif
    const gifOptions = {
      gif: imgRef.current,
      auto_play: autoPlay,
      loop_mode: loop ? 'auto' : 'no',
      loop_delay: loopDelay,
      show_progress_bar: showProgressBar,
      progressbar_height: progressBarHeight,
      progressbar_background_color: progressBarBackgroundColor,
      progressbar_foreground_color: progressBarForegroundColor,
      on_end: onEnd,
      c_w: width,
      c_h: height,
    };

    const controller = new SuperGif(gifOptions);
    
    controller.load((gif) => {
      setGifController(controller);
      setTotalFrames(controller.get_length());
      setIsLoaded(true);
      setIsPlaying(controller.get_playing());
      if (onLoad) onLoad();
    });

    // Start frame tracking interval
    const frameInterval = setInterval(() => {
      if (controller && controller.get_loading() === false) {
        setCurrentFrame(controller.get_current_frame());
        setIsPlaying(controller.get_playing());
      }
    }, 100);

    return () => {
      clearInterval(frameInterval);
    };
  }, [src, width, height, autoPlay, loop, loopDelay]); // Re-initialize when these props change

  // Control functions
  const play = () => {
    if (gifController && !isPlaying) {
      gifController.play();
      setIsPlaying(true);
    }
  };

  const pause = () => {
    if (gifController && isPlaying) {
      gifController.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const moveToFrame = (frameIndex) => {
    if (gifController && isLoaded) {
      gifController.move_to(frameIndex);
      setCurrentFrame(frameIndex);
    }
  };

  const nextFrame = () => {
    if (gifController && isLoaded) {
      gifController.move_relative(1);
      setCurrentFrame(gifController.get_current_frame());
    }
  };

  const prevFrame = () => {
    if (gifController && isLoaded) {
      gifController.move_relative(-1);
      setCurrentFrame(gifController.get_current_frame());
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`gif-player ${className}`}
      style={{ display: 'inline-block', position: 'relative', ...style }}
    >
      <img
        ref={imgRef}
        src={src}
        width={width}
        height={height}
        style={{ display: 'block' }}
        rel:animated_src={src}
        rel:auto_play={autoPlay ? "1" : "0"}
      />
      
      {isLoaded && (
        <div className="gif-controls" style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0,
          background: 'rgba(0,0,0,0.5)',
          padding: '5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button onClick={togglePlay} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={prevFrame} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              ◀
            </button>
            
            <div style={{ color: 'white', margin: '0 8px' }}>
              {currentFrame + 1}/{totalFrames}
            </div>
            
            <button onClick={nextFrame} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GifPlayer;