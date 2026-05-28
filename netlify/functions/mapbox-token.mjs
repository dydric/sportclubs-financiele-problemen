export async function handler() {
  const token = process.env.MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || process.env.mapbox_token || "";

  if (!token) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ error: "Missing MAPBOX_TOKEN" })
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, max-age=300"
    },
    body: JSON.stringify({ token })
  };
}
