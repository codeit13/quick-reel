import fetch from "node-fetch";

/**
 * Search for anime videos on Sakugabooru. Will keep making API calls (with random queries) until at least `limit` unique video URLs are found, then return exactly `limit`.
 * @param {Object} options
 * @param {number} options.limit - Number of unique videos to return (default 10)
 * @param {number} options.minDur - Minimum duration (unused, for compatibility)
 * @param {string} options.query - Main search query (default "anime")
 * @param {string} options.rating - Rating filter (default "safe")
 * @returns {Promise<string[]>}
 */
export async function searchForAnimeVideos({
  limit = 10,
  minDur = 5, // unused, but included for compatibility
  tags = ["universe"],
  rating = "safe",
} = {}) {
  const BASE_URL = "https://www.sakugabooru.com/post.json";
  const uniqueVideos = new Set();
  let attempts = 0;
  const maxAttempts = 10; // Avoid infinite loops
  const queries = [
    ...tags,
    "anime",
    "action",
    "fight",
    "mecha",
    "romance",
    "school",
    "scenery",
    "character",
  ];

  while (uniqueVideos.size < limit && attempts < maxAttempts) {
    const tagQuery = `${
      queries[Math.floor(Math.random() * queries.length)]
    } rating:${rating} order:random`;
    const params = new URLSearchParams({
      limit: limit.toString(),
      tags: tagQuery,
    });
    try {
      const resp = await fetch(`${BASE_URL}?${params.toString()}`);
      if (!resp.ok) {
        console.error(`Sakugabooru API error: ${resp.status}`);
        attempts++;
        continue;
      }
      const data = await resp.json();
      for (const post of data) {
        // The video URL is typically in the 'file_url' field
        if (post.file_url && post.file_url.endsWith(".mp4")) {
          uniqueVideos.add(post.file_url);
        }
      }
    } catch (err) {
      console.error(`Error fetching Sakugabooru:`, err);
    }
    attempts++;
  }
  // Return exactly the requested number of unique video URLs
  const videos = Array.from(uniqueVideos);
  for (let i = videos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [videos[i], videos[j]] = [videos[j], videos[i]];
  }
  return videos.slice(0, limit);
}

// Example usage (uncomment to test)
// (async () => {
//   const videos = await searchForAnimeVideos({ limit: 10 });
//   console.log(videos);
// })();
