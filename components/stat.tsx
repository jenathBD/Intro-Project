// Nøgletal efter BD's .bd-stat: etiket, stor værdi med enhed og en valgfri note under
export function Stat({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="bd-stat">
      <p className="bd-eyebrow">{label}</p>
      <p className="bd-stat__value m-0">
        {value}
        {unit && <small>{unit}</small>}
      </p>
      {note && <p className={`bd-stat__delta m-0 ${tone ? `is-${tone}` : ''}`}>{note}</p>}
    </div>
  );
}
