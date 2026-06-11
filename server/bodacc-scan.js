// Scan BODACC partagé entre la route API (scan manuel) et le planificateur
// quotidien : récupère les annonces de chaque site avec SIREN, insère les
// nouvelles et met à jour le signal dominant de la fiche.

const { db } = require('./db');
const { fetchAnnonces, pickSignal, isRecent } = require('./bodacc');

function cleanSiren(s) {
  return String(s || '').replace(/\D/g, '');
}

// Scanne un site : récupère ses annonces BODACC, insère les nouvelles,
// met à jour le signal dominant de la fiche. Retourne le résumé du scan.
async function scanSite(site) {
  const siren = cleanSiren(site.siren);
  if (siren.length !== 9) return null;

  const annonces = await fetchAnnonces(siren);
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO bodacc_annonces
      (id, site_id, siren, date_parution, famille, famille_lib, type_lib,
       descriptif, niveau, signal, tribunal, url, lu, created_at)
    VALUES
      (@id, @site_id, @siren, @date_parution, @famille, @famille_lib, @type_lib,
       @descriptif, @niveau, @signal, @tribunal, @url, @lu, @created_at)
  `);

  const nouveaux = [];
  for (const a of annonces) {
    // Seules les annonces notables et récentes arrivent « non lues » (alerte) ;
    // l'historique ancien est inséré déjà lu pour ne pas noyer le bandeau.
    const lu = a.niveau !== 'info' && isRecent(a.date_parution) ? 0 : 1;
    const info = await insert.run({ ...a, site_id: site.id, lu, created_at: now });
    if (info.changes > 0) {
      if (lu === 0) nouveaux.push(a);
    } else {
      // Annonce déjà en base : réaligne sa classification sur la grille
      // actuelle (la grille évolue, ex. vente actée passée de critique à vendu).
      await db.prepare(
        'UPDATE bodacc_annonces SET niveau = ?, signal = ? WHERE id = ? AND (niveau != ? OR signal != ?)'
      ).run(a.niveau, a.signal, a.id, a.niveau, a.signal);
    }
  }

  const top = pickSignal(annonces);
  await db.prepare(`
    UPDATE sites SET
      bodacc_checked_at = ?, bodacc_signal = ?, bodacc_niveau = ?, bodacc_signal_date = ?
    WHERE id = ?
  `).run(now, top ? top.signal : '', top ? top.niveau : '', top ? top.date_parution : '', site.id);

  return { site_id: site.id, cc: site.cc, total: annonces.length, nouveaux };
}

// Scanne tous les sites avec SIREN valide (ou seulement siteIds si fourni).
async function scanAll(siteIds = null) {
  let sites = siteIds
    ? await db.prepare(`SELECT * FROM sites WHERE id IN (${siteIds.map(() => '?').join(',')})`).all(...siteIds)
    : await db.prepare('SELECT * FROM sites').all();
  sites = sites.filter((s) => cleanSiren(s.siren).length === 9);

  const details = [];
  const erreurs = [];
  for (const site of sites) {
    try {
      const r = await scanSite(site);
      if (r) details.push(r);
    } catch (e) {
      erreurs.push({ site_id: site.id, cc: site.cc, error: e.message });
    }
    // Pause courte entre deux SIREN pour ménager l'API publique
    if (sites.length > 1) await new Promise((r) => setTimeout(r, 250));
  }

  const nouveaux = details.reduce((n, d) => n + d.nouveaux.length, 0);
  return { scanned: details.length, nouveaux, erreurs, details };
}

module.exports = { scanAll };
