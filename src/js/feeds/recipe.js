import { initRecipe } from '../modules/recipe/index';
import { initTimer } from '../modules/recipe/timer/index';

window.addEventListener('DOMContentLoaded', () => {
	initRecipe();
	initTimer();
});
