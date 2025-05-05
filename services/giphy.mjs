// giphy-multi-util.js
import { GiphyFetch } from "@giphy/js-fetch-api";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const gf = new GiphyFetch(process.env.GIPHY_API_KEY);

/**
 * For each tag in `searchTags`, search Giphy, download the top GIF,
 * and return a mapping from tag → local filename.
 *
 * @param {Object} params
 * @param {string[]} params.searchTags – e.g. ['universe','anime']
 * @param {number} params.limit      – number of results to fetch per tag (we pick the first)
 * @returns {Promise<Object>}        – { universe: 'downloads/universe-1.gif', anime: 'downloads/anime-2.gif' }
 */
export async function searchGifs({ searchTags, limit = 1 }) {
  const outputDir = path.resolve(process.cwd(), "tmp");
  // ensure downloads directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const results = {};

  for (let i = 0; i < searchTags.length; i++) {
    const tag = searchTags[i];
    // 1. search Giphy
    const { data } = await gf.search(tag, {
      limit,
      sort: "relevant",
      lang: "en",
    });
    if (!data.length) {
      console.warn(`No GIFs found for tag "${tag}"`);
      continue;
    }

    // 2. pick the first GIF's original URL
    const gifUrl = data[0].images.original.url;

    // 3. download it
    const filename = `${tag.replace(/\s+/g, "_")}-${i + 1}.gif`;
    const filepath = path.join(outputDir, filename);

    const res = await fetch(gifUrl);
    if (!res.ok) {
      console.error(`Failed to download GIF for "${tag}": ${res.statusText}`);
      continue;
    }
    const buffer = await res.arrayBuffer();
    await fs.writeFile(filepath, Buffer.from(buffer));

    // 4. map tag → local path
    results[tag] = filepath;
  }

  return results;
}
