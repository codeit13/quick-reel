// create-base-reel.mjs
// Workflow: Generate script (LangChain+OpenAI), generate audio (ElevenLabs), tag segments, fetch/trim/merge videos, overlay audio

import { ChatOpenAI } from "@langchain/openai";
import { ElevenLabsClient } from "elevenlabs";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import pLimit from "p-limit";
import path from "path";
import fetch from "node-fetch";

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

import { searchForAnimeVideos } from "./services/sakugabooru.mjs";
import { searchGifs } from "./services/giphy.mjs";

// CONFIGURATION (replace with your keys)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // default voice
const VIDEO_API_URL = process.env.VIDEO_API_URL;
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

// 1. Generate script and tags (structured JSON)
async function generateScriptAndTags({ topic, dummy }) {
  if (dummy) {
    return [
      {
        text: "Welcome to our exploration of the future of AI, a world filled with possibilities and innovations.",
        tag: "Introduction",
      },
      {
        text: "Artificial Intelligence is evolving at an unprecedented pace, reshaping industries and redefining our lives.",
        tag: "Evolution",
      },
      {
        text: "From healthcare to education, AI is transforming how we approach problems and find solutions.",
        tag: "Transformation",
      },
      {
        text: "Imagine AI-driven diagnostics that detect diseases earlier, leading to better outcomes for patients worldwide.",
        tag: "Healthcare",
      },
      {
        text: "In education, personalized learning experiences powered by AI can cater to each student’s unique needs.",
        tag: "Education",
      },
      {
        text: "AI will automate mundane tasks, allowing humans to focus on creativity and strategic decision-making.",
        tag: "Automation",
      },
      {
        text: "However, as we integrate AI into our lives, ethical considerations must guide its development.",
        tag: "Ethics",
      },
      {
        text: "Questions about privacy, bias, and accountability arise as AI systems become increasingly autonomous.",
        tag: "Concerns",
      },
      {
        text: "Collaboration between humans and AI can unlock new frontiers in research and innovation.",
        tag: "Collaboration",
      },
      {
        text: "The future of work will likely involve new roles that focus on managing and working with AI.",
        tag: "Work",
      },
      {
        text: "Education systems must evolve to prepare future generations for an AI-driven job market.",
        tag: "Preparation",
      },
      {
        text: "As we look ahead, global cooperation will be essential to harness AI's potential responsibly.",
        tag: "Cooperation",
      },
      {
        text: "Regulations and policies will need to adapt to ensure AI develops in ways that benefit society.",
        tag: "Regulations",
      },
      {
        text: "In conclusion, the future of AI holds immense promise, but we must navigate it with care.",
        tag: "Conclusion",
      },
      {
        text: "Join us as we continue to explore the implications of AI on our lives.",
        tag: "Exploration",
      },
    ];
  }

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  let llm = new ChatOpenAI({
    apiKey: OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

  const prompt = `Create a short, viral Instagram Reel script on similar to the topic, but not exactly same as: "${topic}".
  - The total duration must be around 40 seconds. 
  - Use a highly engaging, entertaining, meme-like tone. 
  - Start with a strong hook to retain viewer attention in the first 3 seconds.
  - Include relatable or humorous observations that drive shareability.
  - The script should feel like it's being narrated in a reel — punchy and fast-paced.
  - Return the full script as a single string under "audioScriptText".
  - Also return an array of 6-10 one-word descriptive tags that reflect key moments or themes in the script.
  Respond in this exact JSON format:

  {
    "audioScriptText": "Full script here, in a casual storytelling style.",
    "tags": ["tag1", "tag2", "tag3", ...]
  }`;

  llm = llm.withStructuredOutput(
    z.object({
      audioScriptText: z.string(),
      tags: z.array(z.string()),
    }),
  );

  const response = await llm.invoke(prompt);
  try {
    return response;
  } catch (e) {
    throw new Error(
      "Failed to parse LLM JSON: " + e.message + "\nRaw response: " + response,
    );
  }
}

// 2. Generate audio for full script
async function generateAudio({ scriptText, outPath, dummy }) {
  try {
    if (dummy) {
      return outPath;
    }
    const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
    const audio = await elevenlabs.textToSpeech.convert(ELEVENLABS_VOICE_ID, {
      output_format: "mp3_44100_128",
      text: scriptText,
      model_id: "eleven_multilingual_v2",
    });
    await fs.writeFile(outPath, audio);
    return outPath;
  } catch (e) {
    console.log(e);
  }
}

// 3. Fetch and trim videos for each tag
async function fetchAndTrimVideosAndMergeThem(
  tags,
  tempDir,
  outputFile = path.join(tempDir, "merged.mp4"),
  options = {},
  dummy = false,
) {
  // Validate inputs
  // if (!Array.isArray(segments) || segments.length === 0) {
  //   throw new Error("segments must be a non-empty array");
  // }
  // Ensure tempDir exists
  await fs.mkdir(tempDir, { recursive: true });

  // Fetch CDN URLs once
  let videoPaths = [];
  if (dummy) {
    videoPaths = [
      "https://www.sakugabooru.com/data/5fbcd06f56a4d30b1ffc719b0c4a2d7b.mp4",
      "https://www.sakugabooru.com/data/af2999cab0d53b1c2bab651717b61224.mp4",
      "https://www.sakugabooru.com/data/08bf3b2b99512729a5aec8b1d7be7a4b.mp4",
      "https://www.sakugabooru.com/data/b7740e7a8d807277e5c36af4e459592d.mp4",
      "https://www.sakugabooru.com/data/9fd1125995ff3e560d9d6ed5959a9181.mp4",
      "https://www.sakugabooru.com/data/4b89d2557465ddf402f7f6db3f15511f.mp4",
      "https://www.sakugabooru.com/data/eca8d8a22f89d456a7d40be4b4f478b2.mp4",
      "https://www.sakugabooru.com/data/fc1c9275858fde4b8e7e8cfb1660da4b.mp4",
      "https://www.sakugabooru.com/data/42f9a32e4dce7e3d6cf4a9297a0431c0.mp4",
      "https://www.sakugabooru.com/data/f7bc4f6970279883ec0947493220c66b.mp4",
    ];
  } else {
    videoPaths = await searchForAnimeVideos({
      limit: 15,
      tags,
    });
  }
  console.log("Dummy: ", dummy);
  console.log("Video paths: ", videoPaths);

  // Concurrency & retry settings
  const portraitRatio = 9 / 16;

  // Process each segment: download, trim & crop
  const trimmedFiles = await Promise.all(
    videoPaths.map(async (url, i) => {
      const duration = 4;
      console.log("Processing video: ", url);
      if (!url) return;
      const res = await fetch(url);
      const rawPath = path.join(tempDir, `raw_${i}.mp4`);
      await fs.writeFile(rawPath, await res.buffer());

      // Probe dimensions
      const { width: iw, height: ih } = await new Promise((res, rej) =>
        ffmpeg.ffprobe(rawPath, (err, meta) => {
          if (err) return rej(err);
          const s = meta.streams.find((s) => s.width && s.height);
          res({ width: s.width, height: s.height });
        }),
      );

      // Compute centered crop for portrait
      const targetH = ih;
      const targetW = Math.floor(targetH * portraitRatio);
      const x = Math.floor((iw - targetW) / 2);
      const y = 0;

      const outPath = path.join(tempDir, `trimmed_${i}.mp4`);
      await new Promise((res, rej) => {
        ffmpeg(rawPath)
          .setStartTime(0)
          .setDuration(duration)
          .videoFilters(`crop=${targetW}:${targetH}:${x}:${y}`)
          .save(outPath)
          .on("end", res)
          .on("error", rej);
      });

      return outPath;
    }),
  );

  // Merge all trimmed clips
  async function writeListFile(inputs, listPath) {
    const lines = inputs.map((f) => `file '${path.resolve(f)}'`).join("\n");
    await fs.writeFile(listPath, lines);
  }

  // 1. Write the concat-list file
  const listPath = path.resolve(path.dirname(outputFile), "merge_list.txt");
  await writeListFile(trimmedFiles, listPath);

  // 2. Run FFmpeg with no audio
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"]) // concat demuxer to join files :contentReference[oaicite:0]{index=0}
      .outputOptions(["-c:v copy", "-an", "-y"])
      // -c:v copy → copy the video stream (no re-encode)
      // -an        → disable all audio streams in output (silent) :contentReference[oaicite:1]{index=1}
      .on("start", (cmd) => console.log("Spawned FFmpeg with command:", cmd))
      .on("error", (err, stdout, stderr) => {
        console.error("Merge failed:", err.message);
        console.error(stderr);
        reject(err);
      })
      .on("end", () => {
        console.log("Merging (silent) finished successfully.");
        resolve();
      })
      .save(outputFile);
  });

  return outputFile;
}

// 4. Add audio to merged video
async function addAudioWithFreezeTrim(videoPath, audioPath, outPath) {
  function probe(file) {
    return new Promise((res, rej) => {
      ffmpeg.ffprobe(file, (err, data) => (err ? rej(err) : res(data)));
    });
  }

  // 1. Probe durations
  const [vMeta, aMeta] = await Promise.all([
    probe(videoPath),
    probe(audioPath),
  ]);
  const vDur = vMeta.format.duration;
  const aDur = aMeta.format.duration;

  // 2. Compute padding or trim
  const extra = aDur - vDur; // positive => pad, negative => trim
  const needsPad = extra > 0;
  const needsTrim = extra < 0;
  const filters = [];

  if (needsPad) {
    // pad last frame
    filters.push(`tpad=stop_mode=clone:stop_duration=${extra.toFixed(3)}`);
  }

  // 3. Build ffmpeg command
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    cmd
      .input(videoPath)
      .input(audioPath)
      // apply filters if needed
      .videoFilters(filters)
      // map streams
      .outputOptions(
        [
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          // if filters used, must re-encode, else copy
          needsPad ? "-c:v libx264" : "-c:v copy",
          "-c:a aac",
          "-shortest",
          "-y",
          // if trim needed, set duration to audio length
          needsTrim ? `-t ${aDur.toFixed(3)}` : null,
        ].filter(Boolean),
      );

    cmd
      .on("start", (cmdLine) => console.log("FFmpeg command:", cmdLine))
      .on("error", (err, _, stderr) => {
        console.error("Mux error:", stderr);
        reject(err);
      })
      .on("end", () => resolve(outPath))
      .save(outPath);
  });
}

// MAIN WORKFLOW
export async function createBaseReel({
  topic,
  tempDir = "./tmp",
  output = "./public/reel.mp4",
}) {
  await fs.mkdir(tempDir, { recursive: true });
  // 1. Script and tags
  const { audioScriptText, tags } = await generateScriptAndTags({
    topic,
    dummy: false,
  });
  // 2. Audio
  const audioPath = path.resolve(path.join(tempDir, "audio.mp3"));
  await generateAudio({
    scriptText: audioScriptText,
    outPath: audioPath,
    dummy: false,
  });
  // 3. Videos
  const mergedPath = path.join(tempDir, "merged.mp4");
  await fetchAndTrimVideosAndMergeThem(tags, tempDir, mergedPath, {}, false);
  // 4. Add audio
  await addAudioWithFreezeTrim(mergedPath, audioPath, output);
  return { output, segments };
}

// Example usage:
// (async () => {
//   const topics = [
//     "Why Gen Z can’t make a phone call without anxiety",
//     "POV: You open your laptop to work, 3 hours of YouTube later...",
//     "Every Indian parent when you ask them about your childhood trauma",
//     "Signs you’re secretly the friend everyone depends on (but never checks on)",
//     "What your Spotify playlist says about your mental state",
//     "If AI was your clingy ex",
//     "Every programmer ever: Writing code vs Debugging code",
//     "ChatGPT but it has daddy issues",
//     "You vs AI in 2030 job interviews",
//     "Tech bros explaining Web3 to their grandmas",
//     "How I spent ₹3000 in 2 days without buying anything useful",
//     "POV: You get your salary… and your landlord gets it too",
//     "Types of people on UPI – the ‘send 1 rupee first’ gang",
//     "Millennial vs Gen Z investing strategies (meme version)",
//     "When your monthly budget lasts only till the 7th",
//   ];

//   const topic = topics[Math.floor(Math.random() * topics.length)];
//   const fileName = `./public/reel.mp4`;
//   const result = await createBaseReel({
//     topic,
//     tempDir: "./tmp",
//     output: fileName,
//   });
//   console.log("Reel generated successfully: ", result.output);
// })();

const results = await searchGifs({
  searchTags: ["universe", "anime"],
});

console.log(results);
