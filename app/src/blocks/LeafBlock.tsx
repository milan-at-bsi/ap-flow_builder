import { memo } from 'react'
import type { NodeProps } from 'reactflow'

type FieldDef = { name: string }

export type LeafData = {
  label: string
  blockName?: string
  fields?: FieldDef[]
  fieldValues?: Record<string, string>
  onFieldChange?: (fieldName: string, value: string) => void
}

const HEADER_H = 32
const FIELD_ROW_H = 28
const PADDING = 8

export const LeafBlock = memo(function LeafBlock({ data, selected }: NodeProps<LeafData>) {
  const fields = data.fields ?? []
  const fieldValues = data.fieldValues ?? {}
  const hasFields = fields.length > 0
  const totalHeight = hasFields ? HEADER_H + fields.length * FIELD_ROW_H + PADDING * 2 : 44

  return (
    <div
      style={{
        width: 180,
        height: totalHeight,
        background: 'rgba(34,197,94,0.9)',
        borderRadius: 8,
        border: selected ? '3px solid #fff' : '2px solid rgba(255,255,255,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: hasFields ? HEADER_H : totalHeight,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          fontWeight: 600,
          fontSize: 13,
          color: '#fff',
          background: hasFields ? 'rgba(0,0,0,0.1)' : 'transparent',
          flexShrink: 0,
        }}
      >
        {data.label || data.blockName || 'Block'}
      </div>

      {/* Fields (if any) */}
      {hasFields && (
        <div
          style={{
            flex: 1,
            padding: `${PADDING}px 10px`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {fields.map((field) => (
            <div
              key={field.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: FIELD_ROW_H - 4,
              }}
            >
              <label
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.8)',
                  minWidth: 45,
                  flexShrink: 0,
                }}
              >
                {field.name}:
              </label>
              <input
                type="text"
                value={fieldValues[field.name] ?? ''}
                onChange={(e) => data.onFieldChange?.(field.name, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  outline: 'none',
                  minWidth: 0,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
