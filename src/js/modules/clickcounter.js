// Bestand: js/modules/clickcounter.js

import { error, log, warn } from './debug.js'; // ✅ Debug import

const clickCounter = () => {
  const display = document.querySelector('[data-total-clicks]');

  if (!display) {
    warn('⚠️ Geen [data-total-clicks] element gevonden');
    return;
  }

  const fetchClicks = async () => {
    try {
      const res = await fetch('/.netlify/functions/totalclicks');
      if (!res.ok) throw new Error(`Request mislukt: ${res.status}`);

      const json = await res.json();
      const clicks = json?.data?.[0]?.total_clicks;

      if (clicks !== undefined) {
        display.textContent = `${clicks} clicks`;
        display.classList.remove('hidden');
        log(`📈 Totaal aantal clicks opgehaald: ${clicks}`);
      } else {
        warn('⚠️ Geen "total_clicks" gevonden in json.data[0]');
      }
    } catch (err) {
      error('❌ Fout bij ophalen van total_clicks:', err);
    }
  };

  fetchClicks(); // 🚀 Ophalen bij laden
};

export { clickCounter };
