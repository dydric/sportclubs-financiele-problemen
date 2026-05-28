export default function toDateFormat(date) {
  if (!date) return null;

  if (typeof date === "string") {
    // Controleer of het de Threads-notatie is: "February 7, 2025 at 03:31PM"
    const threadsDateMatch = date.match(/^([A-Za-z]+) (\d{1,2}), (\d{4}) at (\d{1,2}):(\d{2})(AM|PM)$/);

    if (threadsDateMatch) {
      const [, month, day, year, hours, minutes, period] = threadsDateMatch;

      // Zet maandnaam om naar maandnummer
      const months = {
        January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
        July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
      };

      const hour24 = period === "PM" && hours !== "12" ? parseInt(hours) + 12 : parseInt(hours);
      return new Date(year, months[month], parseInt(day), hour24, parseInt(minutes));
    }
  }

  // Als het al een geldige datum is, geef het gewoon terug
  return new Date(date);
}
