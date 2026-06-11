// Planificateur du scan BODACC quotidien. Sur l'offre gratuite Render le
// serveur s'endort entre deux visites : un cron à heure fixe ne sonnerait pas
// pendant le sommeil. On vérifie donc au démarrage puis toutes les heures si
// le dernier scan date de plus de BODACC_SCAN_INTERVAL_HOURS (défaut 24 h),
// et on rattrape le retard le cas échéant.

const { db } = require('./db');
const { scanAll } = require('./bodacc-scan');

const INTERVAL_HOURS = Number(process.env.BODACC_SCAN_INTERVAL_HOURS) || 24;
const CHECK_EVERY_MS = 60 * 60 * 1000;
const STARTUP_DELAY_MS = 10 * 1000;

let running = false;

async function scanIfDue() {
  if (running) return;
  running = true;
  try {
    const { checked_at } = await db
      .prepare('SELECT MAX(bodacc_checked_at) AS checked_at FROM sites')
      .get();
    const last = checked_at ? new Date(checked_at).getTime() : 0;
    if (Date.now() - last < INTERVAL_HOURS * 3600000) return;

    console.log('[bodacc] Scan quotidien automatique…');
    const r = await scanAll();
    console.log(
      `[bodacc] Scan terminé : ${r.scanned} site(s), ${r.nouveaux} nouvelle(s) alerte(s)` +
        (r.erreurs.length ? `, ${r.erreurs.length} erreur(s)` : '')
    );
  } catch (e) {
    console.error('[bodacc] Échec du scan automatique :', e.message);
  } finally {
    running = false;
  }
}

function startBodaccScheduler() {
  if (process.env.BODACC_AUTO_SCAN === 'off') {
    console.log('[bodacc] Scan automatique désactivé (BODACC_AUTO_SCAN=off).');
    return;
  }
  setTimeout(scanIfDue, STARTUP_DELAY_MS).unref();
  setInterval(scanIfDue, CHECK_EVERY_MS).unref();
  console.log(`[bodacc] Veille automatique active (scan si le dernier date de plus de ${INTERVAL_HOURS} h).`);
}

module.exports = { startBodaccScheduler };
