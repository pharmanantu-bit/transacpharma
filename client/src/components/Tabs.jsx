export default function Tabs({ active, onChange, tabs }) {
  return (
    <div className="flex gap-1 mb-5 border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
            active === t.key
              ? 'border-amber text-marine'
              : 'border-transparent text-gray-500 hover:text-marine'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
