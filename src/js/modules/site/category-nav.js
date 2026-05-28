export function initCategoryNav() {
	// Navigate on native <select> change
	document.querySelectorAll('[data-js="category-nav"]').forEach((select) => {
		select.addEventListener('change', () => {
			window.location.href = select.value;
		});
	});

	// Close custom <details> picker on outside click or Escape
	const getPickers = () => document.querySelectorAll('details[data-js="category-picker"][open]');

	document.addEventListener('click', (e) => {
		getPickers().forEach((details) => {
			if (!details.contains(e.target)) {
				details.removeAttribute('open');
			}
		});
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			getPickers().forEach((details) => details.removeAttribute('open'));
		}
	});
}
