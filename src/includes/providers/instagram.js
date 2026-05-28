// import Fetch from "@11ty/eleventy-fetch";

// export default class InstagramAPI {
// 	constructor(token, userId) {
// 		this.token = token;
// 		this.userId = userId;
// 		this.baseUrl = `https://graph.instagram.com/`;
// 	}

// 	// Functie om het long-lived token te verversen
// 	async refreshAccessToken() {
// 		const refreshUrl = `${this.baseUrl}refresh_access_token?grant_type=ig_refresh_token&access_token=${this.token}`;

// 		try {
// 			const response = await Fetch(refreshUrl, {
// 				duration: "1d",
// 				type: "json"
// 			});

// 			// Verwerk het vernieuwde token (bijv. opslaan in een database of environment variables)
// 			if (response && response.access_token) {
// 				console.log("✨ Insta Token Refreshed ✨");
// 				// console.log("New access token:", response.access_token);

// 				// WIP - SAVE TOKEN?

// 				return response.access_token;
// 			}
// 		} catch (error) {
// 			console.error("Error refreshing Instagram access token:", error);
// 			return null; // Retourneer null bij een fout
// 		}
// 	}

// 	// Haalt de media gegevens van een gebruiker op en cacht deze in één bestand
// 	async getInstagramMedia(limit = 9, fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", restrict = ["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]) {
// 		const requestUrl = `${this.baseUrl}${this.userId}/media?fields=${fields}&access_token=${this.token}`;

// 		try {
// 			// Haal alle media data in één fetch call
// 			const response = await Fetch(requestUrl, {
// 				duration: "1d", // Cache het resultaat voor 1 dag in één bestand
// 				type: "json"
// 			});

// 			let mediaItems = [];
// 			if (response && response.data) {
// 				let i = 0;
// 				for (let media of response.data) {
// 					// Beperk tot bepaalde media types (bijv. alleen afbeeldingen en albums)
// 					if (restrict.includes(media.media_type) && i < limit) {
// 						i++;
// 						mediaItems.push(media);
// 					}
// 				}
// 			}

// 			// Vernieuw het access token na het ophalen van de data
// 			await this.refreshAccessToken();

// 			return mediaItems; // Retourneer de verzamelde media items
// 		} catch (error) {
// 			console.error('Error fetching Instagram media:', error);
// 			return [];
// 		}
// 	}
// }

// // Export functie om de Instagram feed op te halen
// export async function instagramFeed() {
// 	const token = process.env.INSTAGRAM_TOKEN; // Haal de Instagram token uit de environment variables
// 	const userId = process.env.INSTAGRAM_USER_ID; // Haal de user ID uit de environment variables
// 	const api = new InstagramAPI(token, userId);

// 	return await api.getInstagramMedia();
// }
