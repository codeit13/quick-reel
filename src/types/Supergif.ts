interface SuperGifOptions {
  gif: HTMLImageElement;
  auto_play?: boolean;
  loop_mode?: string;
  loop_delay?: number;
  show_progress_bar?: boolean;
  progressbar_height?: number;
  progressbar_background_color?: string;
  progressbar_foreground_color?: string;
  on_end?: () => void;
  c_w?: number;
  c_h?: number;
}

interface SuperGif {
  load(callback: (gif: HTMLImageElement) => void): void;
  play(): void;
  pause(): void;
  move_relative(amount: number): void;
  move_to(frame_idx: number): void;
  get_playing(): boolean;
  get_canvas(): HTMLCanvasElement;
  get_canvas_scale(): number;
  get_loading(): boolean;
  get_auto_play(): boolean;
  get_length(): number;
  get_current_frame(): number;
  load_url(src: string, callback?: () => void): void;
  load_raw(arr: any, callback?: () => void): void;
  set_frame_offset(frame: number, offset: { x: number; y: number }): void;
}
