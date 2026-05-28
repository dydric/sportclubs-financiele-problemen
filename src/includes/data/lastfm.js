// import {
//   getLastFmTrends,
//   getLastFmTopArtists,
//   getLastFmTopAlbums,
//   getLastFmTopTracks,
//   getLastFmRecentTracks,
//   getLastFmLovedTracks,
// } from "../providers/lastfm.js";


// export default async function () {

//   // Haal de gegevens op van Last.fm
//   const trends = await getLastFmTrends();
//   const recentTracks = await getLastFmRecentTracks();
//   const topArtists = await getLastFmTopArtists("1month");
//   const topAlbums = await getLastFmTopAlbums("1month");
//   const topTracks = await getLastFmTopTracks("1month");
//   const lovedTracks = await getLastFmLovedTracks(5);
//   const overallArtists = await getLastFmTopArtists("overall");
//   // const overallTracks = await getLastFmTopTracks("overall");

//   return {
//     trends,
//     recentTracks,
//     topArtists,
//     topAlbums,
//     topTracks,
//     lovedTracks,
//     overallArtists,
//     // overallTracks
//   };
// }
