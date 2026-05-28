import Fetch from "@11ty/eleventy-fetch";

export default class NotionAPI {
  constructor() {
    // this.url = "https://api.notion.com/v1/databases/48615ef51c964b35badcd46e66b98a45/query";

    this.url = "https://api.notion.com/v1/databases/123aeaaa559f80b59f97d61f72ea78d7/query";
  }

  async getNotionConcerts() {

    try {
      const response = await Fetch(this.url, {
        duration: "1d",
        type: "json",
        fetchOptions: {
          method: "POST",
          headers: {
            'Notion-Version': '2022-06-28',
            'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sorts: [
              {
                "property": "Datum",
                "direction": "descending"
              }
            ],
            page_size: 10
          }),
        },
      });

      return response; // Return the fetched data
    } catch (error) {
      console.error('Error fetching concerts:', error);
      return { results: [] }; // Return an empty array on error
    }
  }
}

// Export NotionAPI instance getNotionConcerts
export async function concerts() {
  const api = new NotionAPI();
  return await api.getNotionConcerts();
}





