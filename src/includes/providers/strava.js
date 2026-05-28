import Fetch from "@11ty/eleventy-fetch";

export default class StravaAPI {
  constructor() {
    // De Strava API URLs voor verschillende gegevens
    this.tokenUrl = `https://www.strava.com/oauth/token?client_id=${process.env.STRAVA_CLIENTID}&client_secret=${process.env.STRAVA_CLIENTSECRET}&refresh_token=${process.env.STRAVA_REFRESHTOKEN}&grant_type=refresh_token`;
    this.statsUrl = `https://www.strava.com/api/v3/athletes/630194/stats`;
    this.activitiesUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=25`;
  }

  // Reusable auth headers keep request URLs stable for Eleventy Fetch cache keys
  getAuthHeaders(accessToken) {
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  // Methode om toegangstoken te vernieuwen
  async getAccessToken() {
    try {
      const response = await Fetch(this.tokenUrl, {
        duration: "1h", // Cache de token voor 1 uur
        type: "json",
        fetchOptions: {
          method: "POST",
        },
      });
      if (!response || response.errors) {
        throw new Error("Error refreshing Strava access token");
      }
      return response.access_token;
    } catch (error) {
      console.error("Failed to get access token:", error);
      throw error; // Gooi de fout opnieuw zodat andere functies dit ook kunnen afhandelen
    }
  }

  // Methode om atletiekstatistieken op te halen
  async getAthleteStats() {
    try {
      const accessToken = await this.getAccessToken();
      const response = await Fetch(this.statsUrl, {
        duration: "1d", // Cache de atletiekstatistieken voor 1 dag
        type: "json",
        fetchOptions: {
          method: "GET",
          headers: this.getAuthHeaders(accessToken),
        },
      });
      return response;
    } catch (error) {
      console.error("Failed to fetch athlete stats:", error);
      return null; // Retourneer null bij een fout, zodat Eleventy nog steeds kan draaien
    }
  }

  // Methode om recente activiteiten op te halen
  async getRecentActivities() {
    try {
      const accessToken = await this.getAccessToken();
      const response = await Fetch(this.activitiesUrl, {
        duration: "1d", // Cache de activiteiten voor 1 dag
        type: "json",
        fetchOptions: {
          method: "GET",
          headers: this.getAuthHeaders(accessToken),
        },
      });
      return response;
    } catch (error) {
      console.error("Failed to fetch recent activities:", error);
      return null; // Retourneer null bij een fout, zodat Eleventy nog steeds kan draaien
    }
  }

  // Methode om een specifieke activiteit op id op te halen
  async getActivityById(activityId) {
    if (!activityId) return null;

    try {
      const accessToken = await this.getAccessToken();
      const response = await Fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
        duration: "1d",
        type: "json",
        fetchOptions: {
          method: "GET",
          headers: this.getAuthHeaders(accessToken),
        },
      });

      if (!response || response.errors) return null;
      return response;
    } catch (error) {
      console.error(`Failed to fetch Strava activity ${activityId}:`, error);
      return null;
    }
  }

  // Methode om streams (route + snelheid) op te halen voor een activiteit
  async getActivityStreams(activityId) {
    if (!activityId) return null;

    try {
      const accessToken = await this.getAccessToken();
      const response = await Fetch(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng,velocity_smooth&key_by_type=true`, {
        duration: "1d",
        type: "json",
        fetchOptions: {
          method: "GET",
          headers: this.getAuthHeaders(accessToken),
        },
      });

      if (!response || response.errors) return null;
      return response;
    } catch (error) {
      console.error(`Failed to fetch Strava streams for ${activityId}:`, error);
      return null;
    }
  }
}

// Export functies om de data van Strava op te halen
export async function getStravaStats() {
  const api = new StravaAPI();
  return await api.getAthleteStats();
}

export async function getStravaActivities() {
  const api = new StravaAPI();
  return await api.getRecentActivities();
}

export async function getStravaActivityById(activityId) {
  const api = new StravaAPI();
  return await api.getActivityById(activityId);
}

export async function getStravaActivityStreams(activityId) {
  const api = new StravaAPI();
  return await api.getActivityStreams(activityId);
}
