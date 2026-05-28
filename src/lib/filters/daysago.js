export default function daysAgo(date) {
  if (!date) return null;

  const postDate = new Date(date);
  if (isNaN(postDate)) return null; // Ongeldige datum check

  const today = new Date();

  // Zet beide datums op middernacht om alleen volledige dagen te vergelijken
  postDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = today - postDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24) + 1);
}
