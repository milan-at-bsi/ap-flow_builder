import { memo } from 'react'
import type { NodeProps } from 'reactflow'

type FieldDef = { name: string }

export type ContainerData = {
  label: string
  blockName?: string
  childIds: string[]
  isHovered?: boolean
  computedWidth?: number
  computedHeight?: number
  fields?: FieldDef[]
  fieldValues?: Record<string, string>
  onFieldChange?: (fieldName: string, value: string) => void
}

const HEADER = 36
const PADDING = 12
const DROP_ZONE_H = 50
const FIELD_ROW_H = 28

export const ContainerBlock = memo(function ContainerBlock({
  data,
  selected,
}: NodeProps<ContainerData>) {
  const w = data.computedWidth ?? 220
  const h = data.computedHeight ?? (HEADER + PADDING * 2 + DROP_ZONE_H)
  const fields = data.fields ?? []
  const fieldValues = data.fieldValues ?? {}
  const fieldsHeight = fields.length > 0 ? fields.length * FIELD_ROW_H + 8 : 0

  return (
    <div
      style={{
        width: w,
        height: h,
        background: 'rgba(59,130,246,0.85)',
        borderRadius: 10,
        border: data.isHovered 
          ? '3px solid rgba(250, 204, 21, 0.9)' 
          : selected 
            ? '3px solid #fff' 
            : '2px solid rgba(255,255,255,0.3)',
        boxShadow: data.isHovered ? '0 0 12px rgba(250, 204, 21, 0.5)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: HEADER,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          fontWeight: 700,
          fontSize: 14,
          color: '#fff',
          background: 'rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
      >
        {data.label || data.blockName || 'Container'}
      </div>

      {/* Fields area (fixed height, below header, above content) */}
      {fields.length > 0 && (
        <div
          style={{
            height: fieldsHeight,
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flexShrink: 0,
          }}
        >
          {fields.map((field) => (
            <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 8, height: FIELD_ROW_H - 4 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', minWidth: 50, flexShrink: 0 }}>
                {field.name}:
              </label>
              <input
                type="text"
                value={fieldValues[field.name] ?? ''}
                onChange={(e) => data.onFieldChange?.(field.name, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 12,
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

      {/* Content area (children render here via React Flow's parentNode) */}
      <div style={{ flex: 1, position: 'relative', minHeight: DROP_ZONE_H + PADDING * 2 }}>
        {/* Drop zone - always at the bottom */}
        <div
          style={{
            position: 'absolute',
            left: PADDING,
            right: PADDING,
            bottom: PADDING,
            height: DROP_ZONE_H - PADDING,
            borderRadius: 6,
            background: data.isHovered ? 'rgba(34,197,94,0.35)' : 'rgba(0,0,0,0.18)',
            border: data.isHovered ? '2px dashed rgba(34,197,94,0.8)' : '2px dashed rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: data.isHovered ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.5)',
            fontSize: 11,
            transition: 'all 0.15s ease',
          }}
        >
          {data.isHovered ? 'Release to drop!' : 'Drop here'}
        </div>
      </div>
    </div>
  )
})
