export default function (date, lang = 'nl') {
	// Normalize input to Date object
	const dateObj = (typeof date === 'string' || typeof date === 'number')
		? new Date(date)
		: date;

	if (!(dateObj instanceof Date) || isNaN(dateObj)) {
		return '';
	}

	const now = new Date();
	const sameYear = dateObj.getFullYear() === now.getFullYear();

	// Format parts using Intl (locale-safe)
	const day = new Intl.DateTimeFormat(lang, { day: '2-digit' }).format(dateObj);
	const month = new Intl.DateTimeFormat(lang, { month: '2-digit' }).format(dateObj);
	const year = new Intl.DateTimeFormat(lang, { year: 'numeric' }).format(dateObj);

	if (sameYear) {
		return `${day}-${month}-${year}`;
	}

	return `${day}-${month}-${year}`;
}
