import { useState } from 'react';
import { STATUTS, STATUT_ORDER, ENSEIGNES } from '../constants';

const EMPTY = {
  cc: '',
  departement: '',
  enseigne: '',
  siren: '',
  pharmacie: '',
  dirigeant: '',
  age: '',
  groupement: '',
  statut: 'todo',
  remarques: ''
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export default function ModalEdition({ mode, site, onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [data, setData] = useState(() =>
    isEdit ? { ...EMPTY, ...site } : { ...EMPTY }
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const inputCls =
    'w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!data.cc.trim()) {
      setError('Le nom du centre commercial (CC) est obligatoire.');
      return;
    }
    setSaving(true);
    const payload = isEdit ? { ...data, id: site.id } : data;
    const res = await onSave(payload);
    setSaving(false);
    if (res && !res.success) setError(res.error || 'Erreur lors de l\'enregistrement');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 fade-anim" onClick={onClose} />

      <div className="relative bg-cream rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-anim">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-extrabold">
            {isEdit ? 'Modifier la fiche' : 'Nouveau site'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-marine text-2xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Centre commercial (CC) *">
                <input className={inputCls} value={data.cc} onChange={(e) => set('cc', e.target.value)} />
              </Field>
            </div>

            <Field label="Département">
              <input className={inputCls} value={data.departement} onChange={(e) => set('departement', e.target.value)} />
            </Field>

            <Field label="Enseigne">
              <input
                className={inputCls}
                list="enseignes-list"
                value={data.enseigne}
                onChange={(e) => set('enseigne', e.target.value)}
              />
              <datalist id="enseignes-list">
                {ENSEIGNES.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </Field>

            <Field label="SIREN">
              <input className={inputCls} value={data.siren} onChange={(e) => set('siren', e.target.value)} />
            </Field>

            <Field label="Pharmacie">
              <input className={inputCls} value={data.pharmacie} onChange={(e) => set('pharmacie', e.target.value)} />
            </Field>

            <Field label="Dirigeant(s)">
              <input className={inputCls} value={data.dirigeant} onChange={(e) => set('dirigeant', e.target.value)} />
            </Field>

            <Field label="Âge(s)">
              <input
                className={inputCls}
                value={data.age}
                onChange={(e) => set('age', e.target.value)}
                placeholder="ex: 66/67 ou ?"
              />
            </Field>

            <Field label="Groupement">
              <input className={inputCls} value={data.groupement} onChange={(e) => set('groupement', e.target.value)} />
            </Field>

            <Field label="Statut">
              <select className={inputCls} value={data.statut} onChange={(e) => set('statut', e.target.value)}>
                {STATUT_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {STATUTS[k].label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Remarques">
                <textarea
                  className={inputCls + ' resize-y'}
                  rows={4}
                  value={data.remarques}
                  onChange={(e) => set('remarques', e.target.value)}
                />
              </Field>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-marine text-white hover:bg-[#262640] disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
