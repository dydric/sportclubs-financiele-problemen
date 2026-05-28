import './modules/site/variables';
import { transitions } from './modules/site/transitions';
import { initTwemoji } from './modules/site/twemoji';
import { initClock } from './modules/site/clock';
import { initEmailLink } from './modules/site/email-link';
import { initSwitch } from './modules/site/switch-text';
import { initAllLikes } from './modules/site/likes';
import { initLazyVideo } from './modules/site/lazy-video';
import { initCategoryNav } from './modules/site/category-nav';

// Geeft aan dat JavaScript actief is
document.body.classList.remove('no-js');
document.body.classList.add('js');

transitions();

window.addEventListener('DOMContentLoaded', () => {
	initTwemoji();
	initClock();
	initEmailLink();
	initSwitch();
	initAllLikes();
	initLazyVideo();
	initCategoryNav();
});
