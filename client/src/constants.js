// Configuration des statuts (libellé + couleurs des badges)
export const STATUTS = {
  cible: { label: 'Cible', bg: '#FDEBC8', text: '#92400E', dot: '#E8A838' },
  surveiller: { label: 'À surveiller', bg: '#FFE4D3', text: '#9A3412', dot: '#FB8C5A' },
  ok: { label: 'OK', bg: '#F1F1EF', text: '#4B5563', dot: '#9CA3AF' },
  opp: { label: 'Opportunité', bg: '#FCE0E0', text: '#B91C1C', dot: '#F26D6D' },
  exclu: { label: 'Exclu', bg: '#D9DAE0', text: '#1F2937', dot: '#475066' },
  todo: { label: 'À confirmer', bg: '#DDF3E1', text: '#166534', dot: '#54C277' }
};

export const STATUT_ORDER = ['cible', 'surveiller', 'todo', 'opp', 'ok', 'exclu'];

// Niveaux de score d'opportunité (renvoyés par l'API : score_label)
export const SCORE_LEVELS = {
  Chaud: { label: 'Chaud', emoji: '🔥', bg: '#FCE0E0', text: '#B91C1C' },
  Tiède: { label: 'Tiède', emoji: '🟠', bg: '#FDEBC8', text: '#92400E' },
  Froid: { label: 'Froid', emoji: '❄️', bg: '#E5EAF1', text: '#475066' },
  Exclu: { label: 'Exclu', emoji: '⛔', bg: '#E5E7EB', text: '#6B7280' }
};

export const ENSEIGNES = ['Carrefour', 'Auchan', 'Leclerc'];

export const DEPARTEMENTS = ['28', '60', '77', '78', '91', '93', '94', '95'];

// Types d'actions (timeline)
export const ACTION_TYPES = {
  contact: { label: 'Contact', color: '#2563EB', emoji: '📞' },
  relance: { label: 'Relance', color: '#E8A838', emoji: '🔁' },
  visite: { label: 'Visite', color: '#16A34A', emoji: '📍' },
  info: { label: 'Info', color: '#7C3AED', emoji: 'ℹ️' },
  note: { label: 'Note', color: '#6B7280', emoji: '📝' }
};

export function ageNumber(age) {
  if (!age) return null;
  const m = String(age).match(/\d{2,3}/);
  return m ? parseInt(m[0], 10) : null;
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}
