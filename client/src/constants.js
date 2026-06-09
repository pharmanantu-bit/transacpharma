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

// Types d'opportunité (Découverte)
export const OPPORTUNITY_TYPES = {
  creation: { label: 'Création', emoji: '🟢', bg: '#DDF3E1', text: '#166534' },
  acquisition: { label: 'Acquisition', emoji: '🎯', bg: '#FDEBC8', text: '#92400E' }
};

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

// Date courte JJ/MM/AA (accepte 'YYYY-MM-DD' ou un ISO complet)
export function formatDateShort(iso) {
  if (!iso) return '';
  try {
    const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso;
  }
}

// Statut d'une relance par rapport à aujourd'hui.
// kind : overdue (passée) | today | soon (≤ 7 j) | later
export function relanceStatus(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d - t0) / 86400000);
  if (diff < 0) return { kind: 'overdue', days: diff, label: `Retard ${-diff} j` };
  if (diff === 0) return { kind: 'today', days: 0, label: "Aujourd'hui" };
  if (diff <= 7) return { kind: 'soon', days: diff, label: `Dans ${diff} j` };
  return { kind: 'later', days: diff, label: `Dans ${diff} j` };
}

// Styles des pastilles de relance (réutilisés Kanban + panneau + fiche)
export const RELANCE_STYLE = {
  overdue: { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' },
  today: { bg: '#FEF3C7', text: '#92400E', dot: '#D97706' },
  soon: { bg: '#FEF9C3', text: '#854D0E', dot: '#CA8A04' },
  later: { bg: '#ECFDF5', text: '#047857', dot: '#10B981' }
};

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
