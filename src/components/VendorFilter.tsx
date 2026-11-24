import { vendorColor } from '../lib/vendors'
import type { Model } from '../lib/types'

interface Props {
  models: Model[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

export function VendorFilter({ models, selected, onChange }: Props) {
  const vendors = [...new Set(models.map((model) => model.vendor))].sort((a, b) =>
    a.localeCompare(b),
  )

  const allSelected = vendors.length > 0 && vendors.every((vendor) => selected.has(vendor))

  const toggle = (vendor: string) => {
    const next = new Set(selected)
    if (next.has(vendor)) next.delete(vendor)
    else next.add(vendor)
    onChange(next)
  }

  const all = () => onChange(new Set(vendors))
  const none = () => onChange(new Set())

  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span className="meta meta-strong">Vendors</span>
      <button type="button" className="btn btn-ghost" onClick={all} disabled={allSelected}>
        All
      </button>
      <button type="button" className="btn btn-ghost" onClick={none} disabled={selected.size === 0}>
        None
      </button>
      <span className="meta" style={{ marginLeft: 4 }}>
        {selected.size} / {vendors.length}
      </span>
      <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginLeft: 8 }}>
        {vendors.map((vendor) => {
          const active = selected.has(vendor)
          return (
            <button
              key={vendor}
              type="button"
              className={`badge ${active ? 'badge-accent' : ''}`}
              style={{ borderColor: active ? vendorColor(vendor) : undefined }}
              onClick={() => toggle(vendor)}
              title={`${active ? 'Exclude' : 'Include'} ${vendor}`}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: vendorColor(vendor),
                  marginRight: 4,
                  verticalAlign: 'middle',
                }}
              />
              {vendor}
            </button>
          )
        })}
      </div>
    </div>
  )
}
