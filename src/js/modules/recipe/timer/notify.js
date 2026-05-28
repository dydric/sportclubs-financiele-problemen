import { log, warn } from '../../site/debug.js';

let permissionAsked = false;

const requestPermission = async () => {
	if (permissionAsked || !('Notification' in window)) return;
	permissionAsked = true;
	if (Notification.permission === 'default') {
		await Notification.requestPermission();
	}
};

const sendNotification = (label) => {
	if (!('Notification' in window) || Notification.permission !== 'granted') return;
	try {
		new Notification('Timer klaar!', { body: `${label} is klaar.` });
		log(`⏱️ Notificatie verstuurd: ${label}`);
	} catch (err) {
		warn(`⏱️ Notificatie mislukt: ${err.message}`);
	}
};

export { requestPermission, sendNotification };
