import React, { useState } from 'react'
import { parse as parseYaml } from 'yaml'

interface BlockNode {
  type: 'container' | 'leaf'
  name: string
  fields?: Record<string, string>
  children?: BlockNode[]
}

interface DiagramYaml {
  diagram?: BlockNode | BlockNode[]
}

interface BlockPreviewProps {
  yaml: string
  onApply?: () => void
  showApplyButton?: boolean
}

/**
 * Renders a YAML flow as a visual block tree preview
 */
export function BlockPreview({ yaml, onApply, showApplyButton = true }: BlockPreviewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']))
  
  // Parse YAML
  let diagram: BlockNode | BlockNode[] | null = null
  let parseError: string | null = null
  
  try {
    const parsed = parseYaml(yaml) as DiagramYaml
    diagram = parsed?.diagram || null
  } catch (e: any) {
    parseError = e.message
  }

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const renderNode = (node: BlockNode, path: string, depth: number) => {
    const isContainer = node.type === 'container'
    const hasChildren = isContainer && node.children && node.children.length > 0
    const isExpanded = expanded.has(path)
    
    // Get key field values for display
    const displayFields = Object.entries(node.fields || {})
      .filter(([_, v]) => v && String(v).trim())
      .slice(0, 2)

    return (
      <div key={path} style={{ marginLeft: depth * 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            borderRadius: 4,
            background: isContainer ? 'rgba(139, 92, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${isContainer ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            marginBottom: 4,
            cursor: hasChildren ? 'pointer' : 'default',
          }}
          onClick={() => hasChildren && toggleExpand(path)}
        >
          {/* Expand/collapse indicator */}
          {hasChildren && (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', width: 12 }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span style={{ width: 12 }} />}
          
          {/* Block type icon */}
          <span style={{ fontSize: 12 }}>
            {isContainer ? '📦' : '🏷️'}
          </span>
          
          {/* Block name */}
          <span style={{ 
            fontWeight: 600, 
            fontSize: 12, 
            color: isContainer ? '#a78bfa' : '#34d399'
          }}>
            {node.name}
          </span>
          
          {/* Field values */}
          {displayFields.length > 0 && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
              {displayFields.map(([k, v]) => `${k}: ${v}`).join(', ')}
            </span>
          )}
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div style={{ borderLeft: '1px dashed var(--border-color)', marginLeft: 20, paddingLeft: 8 }}>
            {node.children!.map((child, i) => renderNode(child, `${path}-${i}`, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (parseError) {
    return (
      <div style={{
        padding: 12,
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 6,
        color: '#f87171',
        fontSize: 11,
      }}>
        Failed to parse YAML: {parseError}
      </div>
    )
  }

  if (!diagram) {
    return (
      <div style={{
        padding: 12,
        background: 'var(--bg-tertiary)',
        borderRadius: 6,
        color: 'var(--text-secondary)',
        fontSize: 11,
        textAlign: 'center',
      }}>
        No diagram structure found
      </div>
    )
  }

  // Handle both single node and array of nodes
  const nodes = Array.isArray(diagram) ? diagram : [diagram]

  return (
    <div>
      <div style={{
        padding: 12,
        background: 'var(--bg-tertiary)',
        borderRadius: 6,
        marginBottom: 8,
      }}>
        {nodes.map((node, i) => renderNode(node, `root-${i}`, 0))}
      </div>
      
      {showApplyButton && onApply && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onApply}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#10b981',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontWeight: 600,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Apply to Canvas
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Compact inline block preview for chat messages
 */
export function InlineBlockPreview({ yaml }: { yaml: string }) {
  let diagram: BlockNode | BlockNode[] | null = null
  
  try {
    const parsed = parseYaml(yaml) as DiagramYaml
    diagram = parsed?.diagram || null
  } catch {
    return null
  }

  if (!diagram) return null

  const renderInlineNode = (node: BlockNode, depth: number): React.ReactNode => {
    const isContainer = node.type === 'container'
    const indent = '  '.repeat(depth)
    const icon = isContainer ? '📦' : '🏷️'
    
    // Get first meaningful field value
    const firstField = Object.entries(node.fields || {})
      .find(([_, v]) => v && String(v).trim())
    
    const fieldDisplay = firstField ? `: ${firstField[1]}` : ''
    
    return (
      <React.Fragment key={`${depth}-${node.name}`}>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: 11, 
          color: isContainer ? '#a78bfa' : '#34d399',
          whiteSpace: 'pre'
        }}>
          {indent}{icon} {node.name}{fieldDisplay}
        </div>
        {node.children?.map((child, i) => renderInlineNode(child, depth + 1))}
      </React.Fragment>
    )
  }

  const nodes = Array.isArray(diagram) ? diagram : [diagram]
  
  return (
    <div style={{
      padding: 8,
      background: 'var(--bg-tertiary)',
      borderRadius: 4,
      border: '1px solid var(--border-color)',
    }}>
      {nodes.map((node, i) => (
        <React.Fragment key={i}>
          {renderInlineNode(node, 0)}
        </React.Fragment>
      ))}
    </div>
  )
}
