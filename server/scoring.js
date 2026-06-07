// Scoring d'opportunité d'acquisition.
// Calcule un score 0-100 + un niveau (Chaud / Tiède / Froid / Exclu)
// à partir des signaux disponibles sur une fiche site.

function parseAges(age) {
  if (!age) return [];
  const nums = String(age).match(/\d{2,3}/g);
  if (!nums) return [];
  return nums.map(Number).filter((n) => n >= 20 && n <= 110);
}

const SIGNALS = [
  { re: /sans successeur|sans rel[èe]ve|pas de successeur/i, pts: 20, label: 'Pas de successeur identifié' },
  { re: /r[ée]duction.{0,12}capital|capital r[ée]duit/i, pts: 12, label: 'Réduction de capital récente' },
  { re: /sortie/i, pts: 10, label: 'Sortie évoquée' },
  { re: /prioritaire/i, pts: 10, label: 'Marqué prioritaire' },
  { re: /transformation|sarl.{0,6}selarl|→\s*selar(l|las)|→selar/i, pts: 8, label: 'Transformation juridique récente' },
  { re: /couple/i, pts: 8, label: 'Couple de cogérants' },
  { re: /deux sexag[ée]naires|cog[ée]rants/i, pts: 6, label: 'Cogérance senior' },
  { re: /d[ée]part cog[ée]rant|d[ée]sint[ée]resser/i, pts: 6, label: 'Mouvement d\'associé en cours' }
];

function isSansPharmacie(site) {
  const p = (site.pharmacie || '').trim().toLowerCase();
  return p === '' || p === 'aucune' || p === '?' || p.startsWith('liquid');
}

function computeScore(site) {
  const statut = site.statut || 'todo';

  // Sites exclus : hors scope
  if (statut === 'exclu') {
    return { score: 0, label: 'Exclu', reasons: ['Site exclu de la prospection'] };
  }

  const reasons = [];
  let score = 0;
  const remarques = site.remarques || '';

  // 1. Âge du dirigeant le plus âgé (signal n°1 de cession)
  const ages = parseAges(site.age);
  const maxAge = ages.length ? Math.max(...ages) : null;
  if (maxAge != null) {
    if (maxAge >= 65) {
      score += 35;
      reasons.push(`Dirigeant ${maxAge} ans (≥ 65)`);
    } else if (maxAge >= 60) {
      score += 28;
      reasons.push(`Dirigeant sexagénaire (${maxAge} ans)`);
    } else if (maxAge >= 55) {
      score += 16;
      reasons.push(`Dirigeant ${maxAge} ans (55-59)`);
    } else if (maxAge < 45) {
      score -= 8;
      reasons.push(`Dirigeant jeune (${maxAge} ans)`);
    }
  }

  // 2. Signaux textuels dans les remarques
  for (const s of SIGNALS) {
    if (s.re.test(remarques)) {
      score += s.pts;
      reasons.push(s.label);
    }
  }

  // 3. Statut courant
  if (statut === 'cible') {
    score += 12;
    reasons.push('Déjà marqué « cible »');
  } else if (statut === 'surveiller') {
    score += 6;
    reasons.push('Sous surveillance');
  }

  // 4. Pas de pharmacie existante
  if (isSansPharmacie(site)) {
    if (site.opportunite_type === 'creation') {
      // Galerie + hypermarché SANS pharmacie = opportunité de création (cible recherchée)
      score += 30;
      reasons.push('Galerie + hyper sans pharmacie : opportunité de création');
    } else {
      score = Math.round(score * 0.3);
      reasons.push('Pas de pharmacie existante (emplacement, pas un rachat)');
    }
  }

  // 5. Réseau Apothical (récent / structuré) → peu pertinent pour un rachat
  if ((site.groupement || '').toLowerCase().includes('apothical')) {
    score = Math.min(score, 10);
    reasons.push('Réseau Apothical (peu pertinent)');
  }

  score = Math.max(0, Math.min(100, score));

  let label;
  if (score >= 55) label = 'Chaud';
  else if (score >= 30) label = 'Tiède';
  else label = 'Froid';

  if (reasons.length === 0) reasons.push('Aucun signal fort identifié');

  return { score, label, reasons };
}

module.exports = { computeScore };
