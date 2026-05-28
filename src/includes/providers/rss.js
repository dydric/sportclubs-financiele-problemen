import Fetch from "@11ty/eleventy-fetch";
import fs from "fs";
import Parser from "rss-parser";

export default class RSSAPI {
  constructor() {
    this.feeds = [
      {
        url: "https://albumwhale.com/Diederik/now-listening.atom",
        name: "albumwhale",
      },
      {
        url: "https://feeds.pinboard.in/rss/secret:3582808daf663c954d58/u:dydric/t::read/",
        name: "pinboard",
      },
      {
        url: "https://letterboxd.com/Dydric/rss/",
        name: "letterboxd",
      },
      {
        url: "https://www.goodreads.com/review/list_rss/187949601?key=U-mcXYdGOmOcpiaPx2ebqh65Mwky1mcYmOIZlMPnvNvDqDEA&shelf=read",
        name: "goodreads",
      }
    ];
  }

  async getRssData(feedName, outputFile) {
    const feed = this.feeds.find((f) => f.name === feedName);
    if (!feed) {
      throw new Error(`Feed ${feedName} not found`);
    }

    try {
      const response = await Fetch(feed.url, {
        duration: "1d",
        type: "text",
        fetchOptions: {
          method: "GET",
        },
      });

      let parser = new Parser({
        customFields: {
          item: [
            ["letterboxd:filmTitle", "filmTitle"],
            ["letterboxd:filmYear", "filmYear"],
            ["letterboxd:memberRating", "memberRating"],
            ["letterboxd:watchedDate", "watchedDate"],
            ["letterboxd:rewatch", "rewatch"],
          ],
        },
      });

      let parsedFeed = await parser.parseString(response);

      // Verwerk elk item en haal de src uit de description
      parsedFeed.items = parsedFeed.items.map((item) => {
        // console.log("Content:", item.content); // Debug: Bekijk de inhoud van content

        if (item.content) {
          // Zoek naar de img src binnen de content
          const imgSrcMatch = item.content.match(/<img[^>]+src="([^"]+)"/i);
          item.cover = imgSrcMatch ? imgSrcMatch[1] : null;
        } else {
          item.cover = null;
        }

        return item;
      });

      if (outputFile) {
        fs.writeFileSync(outputFile, JSON.stringify(parsedFeed, null, 2));
      }

      return parsedFeed;
    } catch (error) {
      console.error(`Error fetching RSS feed: ${feedName}`, error);
      return null;
    }
  }
}

export async function getRssData(feedName, outputFile) {
  const api = new RSSAPI();
  return await api.getRssData(feedName, outputFile);
}
