import { UNIT_SETTING_GROUPS, type DefaultUnits, type Dim } from '../engine/units'

export function UnitSettings({
  value,
  onChange,
}: {
  value: DefaultUnits
  onChange: (next: DefaultUnits) => void
}) {
  const setDim = (dim: Dim, id: string) => {
    const next = { ...value }
    if (!id) delete next[dim]
    else next[dim] = id
    onChange(next)
  }

  const hasCustom = Object.keys(value).length > 0

  return (
    <section className="unit-settings" aria-label="Default units">
      <div className="unit-settings-head">
        <h2>Default units</h2>
        <button type="button" className="unit-reset" disabled={!hasCustom} onClick={() => onChange({})}>
          Reset
        </button>
      </div>
      <p className="unit-settings-hint">
        Quantities typed without “to …” convert into these units. Automatic keeps the built-in SI ↔ US pair.
      </p>
      {UNIT_SETTING_GROUPS.map((group) => (
        <details key={group.id} className="unit-group" open>
          <summary>{group.title}</summary>
          <div className="unit-group-body">
            {group.items.map((item) => (
              <label key={item.dim} className="unit-row">
                <span className="unit-row-label">{item.label} default unit</span>
                <select
                  value={value[item.dim] ?? ''}
                  onChange={(e) => setDim(item.dim, e.target.value)}
                >
                  <option value="">Automatic</option>
                  {item.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      ))}
    </section>
  )
}
