import random
import aiohttp
from loguru import logger
from typing import List, Optional


async def search_for_anime_videos(
    limit: int = 10,
    min_dur: int = 5,
    query: str = "anime",
    rating: str = "safe",
) -> List[str]:
    """
    Search for anime videos on Sakugabooru. Will keep making API calls (with random queries) until at least 10 unique video URLs are found, then return exactly 10.
    """

    BASE_URL = "https://www.sakugabooru.com/post.json"
    unique_videos = set()
    attempts = 0
    max_attempts = 10  # Avoid infinite loops
    queries = [query, "anime", "action", "fight", "mecha",
               "romance", "school", "scenery", "character"]
    import random
    while len(unique_videos) < limit and attempts < max_attempts:
        params = {
            "limit": limit,
            "tags": f"{random.choice(queries)} rating:{rating} order:random",
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(BASE_URL, params=params) as resp:
                    if resp.status != 200:
                        logger.error(f"Sakugabooru API error: {resp.status}")
                        attempts += 1
                        continue
                    data = await resp.json()
                    for post in data:
                        file_url = post.get("file_url")
                        if file_url and (file_url.endswith(".webm") or file_url.endswith(".mp4")):
                            unique_videos.add(file_url)
                        elif post.get("sample_url"):
                            sample_url = post["sample_url"]
                            if sample_url.endswith(".webm") or sample_url.endswith(".mp4"):
                                unique_videos.add(sample_url)
                        if len(unique_videos) >= limit:
                            break
        except Exception as e:
            logger.error(f"Error searching Sakugabooru: {e}")
        attempts += 1
    logger.info(
        f"Accumulated {len(unique_videos)} unique anime videos from Sakugabooru.")
    return list(unique_videos)[:limit]


async def get_random_videos_by_pattern(pattern: str, limit: int = 5) -> list[str]:
    """
    Fetch tags matching the pattern, then fetch videos for each tag, and return a randomized list of video URLs up to the specified limit.
    """
    tags = await fetch_tags(query=pattern, limit=5)
    if not tags:
        return []
    all_videos = []
    for tag in tags:
        tag_name = tag.get('name')
        videos = await search_for_anime_videos(query=tag_name, limit=limit)
        all_videos.extend(videos)
    random.shuffle(all_videos)
    return all_videos[:limit]


async def fetch_tags(query: str = "", limit: int = 5, order: str = "count") -> list[dict]:
    """
    Fetch tags from Sakugabooru API. Returns a list of tag dicts.
    :param query: Partial or full tag name to search for.
    :param limit: Number of tags to fetch.
    :param order: Order by 'count', 'date', or 'name'.
    """
    TAGS_URL = "https://www.sakugabooru.com/tag.json"
    params = {
        "limit": limit,
        "order": order,
    }
    if query:
        params["name_pattern"] = query
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(TAGS_URL, params=params) as resp:
                if resp.status != 200:
                    logger.error(f"Sakugabooru tag API error: {resp.status}")
                    return []
                tags = await resp.json()
                logger.info(f"Fetched {len(tags)} tags for pattern '{query}'")
                return tags
    except Exception as e:
        logger.error(f"Error fetching tags: {e}")
    return []


if __name__ == "__main__":
    import asyncio
    import sys

    async def main():
        # Usage: python3 sakugabooru.py pattern <string>
        # Example: python3 sakugabooru.py pattern fire
        if len(sys.argv) > 1 and sys.argv[1] == "pattern":
            pattern = sys.argv[2] if len(sys.argv) > 2 else "anime"
            print(f"Fetching tags for pattern: {pattern}")
            tags = await fetch_tags(query=pattern)
            if not tags:
                print("No tags found for pattern.")
                return
            print("Tags found:")
            for tag in tags:
                print(f"  {tag.get('name')} (count: {tag.get('count')})")
            print("\nFetching videos for each tag:")
            for tag in tags:
                tag_name = tag.get('name')
                print(f"\nVideos for tag: {tag_name}")
                urls = await search_for_anime_videos(query=tag_name)
                if urls:
                    for url in urls:
                        print(url)
                else:
                    print("  No videos found for this tag.")
        else:
            # Default: search for videos by query string
            query = sys.argv[1] if len(sys.argv) > 1 else "anime"
            print(f"Searching Sakugabooru for videos: {query}")
            urls = await search_for_anime_videos(query=query)
            print("Results:")
            for url in urls:
                print(url)

    asyncio.run(main())
