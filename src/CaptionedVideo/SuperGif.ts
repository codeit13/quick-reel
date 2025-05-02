import { MutableRefObject } from "react";

// Utility functions
const bitsToNum = (ba: boolean[]): number =>
  ba.reduce((s, n) => s * 2 + (n ? 1 : 0), 0);
const byteToBitArr = (bite: number): boolean[] => {
  const a: boolean[] = [];
  for (let i = 7; i >= 0; i--) a.push(Boolean(bite & (1 << i)));
  return a;
};

// Stream reader
type StreamData = Uint8Array | string;
class Stream {
  private data: StreamData;
  private pos = 0;
  public len: number;
  constructor(data: StreamData) {
    this.data = data;
    this.len = data instanceof Uint8Array ? data.length : data.length;
  }
  readByte(): number {
    if (this.pos >= this.len)
      throw new Error("Attempted to read past end of stream.");
    if (this.data instanceof Uint8Array) return this.data[this.pos++];
    return this.data.charCodeAt(this.pos++) & 0xff;
  }
  readBytes(n: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < n; i++) bytes.push(this.readByte());
    return bytes;
  }
  read(n: number): string {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.readByte());
    return s;
  }
  readUnsigned(): number {
    const a = this.readBytes(2);
    return (a[1] << 8) + a[0];
  }
}

// LZW decode
const lzwDecode = (minCodeSize: number, data: string): number[] => {
  let pos = 0;
  const readCode = (size: number): number => {
    let code = 0;
    for (let i = 0; i < size; i++) {
      if (data.charCodeAt(pos >> 3) & (1 << (pos & 7))) code |= 1 << i;
      pos++;
    }
    return code;
  };
  const output: number[] = [];
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  const clear = () => {
    dict = [];
    codeSize = minCodeSize + 1;
    for (let i = 0; i < clearCode; i++) dict[i] = [i];
    dict[clearCode] = [];
    dict[eoiCode] = [];
  };
  clear();
  let code!: number;
  let last!: number;
  while (true) {
    last = code;
    code = readCode(codeSize);
    if (code === clearCode) {
      clear();
      continue;
    }
    if (code === eoiCode) break;
    if (code < dict.length) {
      if (last !== clearCode) dict.push([...dict[last], dict[code][0]]);
    } else {
      if (code !== dict.length) throw new Error("Invalid LZW code.");
      dict.push([...dict[last], dict[last][0]]);
    }
    output.push(...dict[code]);
    if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
  }
  return output;
};

// Handlers
type GifHandler = Partial<{
  hdr: (hdr: any) => void;
  gce: (gce: any) => void;
  com: (com: any) => void;
  pte: (pte: any) => void;
  app: Record<string, (block: any) => void>;
  unknown: (block: any) => void;
  img: (img: any) => void;
  eof: (block: any) => void;
}>;

// parseGIF implementation
const parseGIF = (st: Stream, handler: GifHandler) => {
  const parseCT = (entries: number) => {
    const ct: number[][] = [];
    for (let i = 0; i < entries; i++) ct.push(st.readBytes(3));
    return ct;
  };
  const readSubBlocks = (): string => {
    let size: number;
    let data = "";
    do {
      size = st.readByte();
      data += st.read(size);
    } while (size !== 0);
    return data;
  };
  const parseHeader = () => {
    const hdr: any = {};
    hdr.sig = st.read(3);
    hdr.ver = st.read(3);
    if (hdr.sig !== "GIF") throw new Error("Not a GIF file.");
    hdr.width = st.readUnsigned();
    hdr.height = st.readUnsigned();
    const bits = byteToBitArr(st.readByte());
    hdr.gctFlag = bits.shift();
    hdr.colorRes = bitsToNum(bits.splice(0, 3));
    hdr.sorted = bits.shift();
    hdr.gctSize = bitsToNum(bits.splice(0, 3));
    hdr.bgColor = st.readByte();
    hdr.pixelAspectRatio = st.readByte();
    if (hdr.gctFlag) hdr.gct = parseCT(1 << (hdr.gctSize + 1));
    handler.hdr?.(hdr);
  };
  const parseExt = (block: any) => {
    block.label = st.readByte();
    switch (block.label) {
      case 0xf9: {
        st.readByte();
        const bits = byteToBitArr(st.readByte());
        block.reserved = bits.splice(0, 3);
        block.disposalMethod = bitsToNum(bits.splice(0, 3));
        block.userInput = bits.shift();
        block.transparencyGiven = bits.shift();
        block.delayTime = st.readUnsigned();
        block.transparencyIndex = st.readByte();
        st.readByte();
        handler.gce?.(block);
        break;
      }
      case 0xfe: {
        block.comment = readSubBlocks();
        handler.com?.(block);
        break;
      }
      case 0x01: {
        st.readByte();
        st.readBytes(12);
        block.ptData = readSubBlocks();
        handler.pte?.(block);
        break;
      }
      case 0xff: {
        st.readByte();
        const id = st.read(8);
        st.read(3);
        block.appData = readSubBlocks();
        handler.app?.[id]?.(block);
        break;
      }
      default: {
        block.data = readSubBlocks();
        handler.unknown?.(block);
        break;
      }
    }
  };
  const parseImg = (img: any) => {
    img.leftPos = st.readUnsigned();
    img.topPos = st.readUnsigned();
    img.width = st.readUnsigned();
    img.height = st.readUnsigned();
    const bits = byteToBitArr(st.readByte());
    img.lctFlag = bits.shift();
    img.interlaced = bits.shift();
    img.sorted = bits.shift();
    bits.splice(0, 2);
    img.lctSize = bitsToNum(bits.splice(0, 3));
    if (img.lctFlag) img.lct = parseCT(1 << (img.lctSize + 1));
    img.lzwMinCodeSize = st.readByte();
    const lzwData = readSubBlocks();
    img.pixels = lzwDecode(img.lzwMinCodeSize, lzwData);
    handler.img?.(img);
  };
  const parseBlock = () => {
    const sentinel = st.readByte();
    if (sentinel === 0x3b) {
      handler.eof?.({});
      return;
    }
    if (sentinel === 0x2c) {
      parseImg({});
    } else if (sentinel === 0x21) {
      parseExt({});
    } else throw new Error(`Unknown block: 0x${sentinel.toString(16)}`);
    setTimeout(parseBlock, 0);
  };
  parseHeader();
  setTimeout(parseBlock, 0);
};

// Options interface
interface SuperGifOptions {
  gif: HTMLImageElement;
  auto_play?: boolean;
  on_end?: (gif: HTMLImageElement) => void;
  loop_delay?: number;
  loop_mode?: boolean | "auto";
  draw_while_loading?: boolean;
  show_progress_bar?: boolean;
  progressbar_height?: number;
  progressbar_background_color?: string;
  progressbar_foreground_color?: string;
  vp_l?: number;
  vp_t?: number;
  vp_w?: number;
  vp_h?: number;
  c_w?: number;
  c_h?: number;
  max_width?: number;
}

export default class SuperGif {
  private options: Required<SuperGifOptions>;
  private onEndListener: (gif: HTMLImageElement) => void;
  private stream!: Stream;
  private loading = false;
  private frames: ImageData[] = [];
  private gifElement: HTMLImageElement;
  private currentFrame = 0;
  private playing = false;

  constructor(opts: SuperGifOptions) {
    this.options = {
      auto_play: true,
      on_end: () => {},
      loop_delay: 0,
      loop_mode: "auto",
      draw_while_loading: true,
      show_progress_bar: true,
      progressbar_height: 25,
      progressbar_background_color: "rgba(255,255,255,0.4)",
      progressbar_foreground_color: "rgba(255,0,22,0.8)",
      vp_l: 0,
      vp_t: 0,
      vp_w: NaN,
      vp_h: NaN,
      c_w: NaN,
      c_h: NaN,
      max_width: NaN,
      ...opts,
    };
    this.gifElement = this.options.gif;
    this.onEndListener =
      typeof this.options.on_end === "function"
        ? this.options.on_end
        : () => {};
  }

  public load(): void {
    this.loading = true;
    const xhr = new XMLHttpRequest();
    xhr.open("GET", this.gifElement.src, true);
    xhr.overrideMimeType &&
      xhr.overrideMimeType("text/plain; charset=x-user-defined");
    xhr.responseType = "arraybuffer";
    xhr.onload = () => {
      if (xhr.status !== 200) throw new Error("Failed to load GIF");
      const data = new Uint8Array(xhr.response as ArrayBuffer);
      this.stream = new Stream(data);
      parseGIF(this.stream, {
        img: (img) => {
          /* collect frames */
        },
        eof: () => {
          this.loading = false;
          this.onEndListener(this.gifElement);
        },
      });
    };
    xhr.send();
  }

  public play(): void {
    this.playing = true;
    // TODO: implement animation loop
  }

  public pause(): void {
    this.playing = false;
    // TODO: stop animation loop
  }

  public get_playing(): boolean {
    return this.playing;
  }

  public get_loading(): boolean {
    return this.loading;
  }

  public get_length(): number {
    return this.frames.length;
  }

  public get_current_frame(): number {
    return this.currentFrame;
  }
}
