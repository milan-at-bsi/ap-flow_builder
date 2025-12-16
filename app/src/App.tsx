import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, { Background, Controls, useNodesState } from 'reactflow'
import type { Node, NodeTypes, ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'
import { parse as parseYaml } from 'yaml'

import { ContainerBlock } from './blocks/ContainerBlock'
import { LeafBlock } from './blocks/LeafBlock'
import { attachChild, detachChild, getNodeHeight, getNodeWidth, isPointInRect, relayoutChildren } from './blocks/layout'
import { toYaml, fromYaml } from './blocks/serialization'
import { flowToPlanSpace } from './blocks/planspaceTransformer'
import { listFlows, createFlow, updateFlow, deleteFlow as deleteFlowApi, type Flow } from './api'

// Block definition types
type FieldDef = { name: string; default?: string; options?: string[] }
type BlockDef = { type: 'container' | 'leaf'; name: string; block_type?: string; fields?: FieldDef[] }
type BlockDefsYaml = { blocks: BlockDef[] }

// Workspace types
type WorkspaceDef = { name: string; file: string }
type WorkspacesYaml = { workspaces: WorkspaceDef[] }

export default function App() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [rf, setRf] = useState<ReactFlowInstance | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [hoveredContainerId, setHoveredContainerId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [blockDefs, setBlockDefs] = useState<BlockDef[]>([])
  const [yamlContent, setYamlContent] = useState('')
  const [yamlError, setYamlError] = useState<string | null>(null)
  
  // Tab state for YAML pane
  const [activeTab, setActiveTab] = useState<'flow' | 'planspace'>('flow')
  const [planspaceContent, setPlanspaceContent] = useState('')
  const [planspaceError, setPlanspaceError] = useState<string | null>(null)
  
  // Workspace state
  const [workspaces, setWorkspaces] = useState<WorkspaceDef[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')
  
  // Flow management state
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null)
  const [flowName, setFlowName] = useState('')
  const [flowExternalId, setFlowExternalId] = useState('')
  const [savedFlows, setSavedFlows] = useState<Flow[]>([])
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [flowMessage, setFlowMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
  })

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  // Load workspaces manifest on startup
  useEffect(() => {
    fetch('/workspaces.yaml')
      .then((res) => res.text())
      .then((text) => {
        const parsed = parseYaml(text) as WorkspacesYaml
        const ws = parsed.workspaces ?? []
        setWorkspaces(ws)
        // Auto-select first workspace
        if (ws.length > 0 && !selectedWorkspace) {
          setSelectedWorkspace(ws[0].name)
        }
      })
      .catch((err) => console.error('Failed to load workspaces:', err))
  }, [])

  // Load block definitions when workspace changes
  useEffect(() => {
    if (!selectedWorkspace || workspaces.length === 0) return
    
    const ws = workspaces.find((w) => w.name === selectedWorkspace)
    if (!ws) return

    fetch(`/${ws.file}`)
      .then((res) => res.text())
      .then((text) => {
        const parsed = parseYaml(text) as BlockDefsYaml
        setBlockDefs(parsed.blocks ?? [])
        // Clear canvas when switching workspaces
        setNodes([])
        setYamlContent('')
        setYamlError(null)
      })
      .catch((err) => console.error('Failed to load workspace blocks:', err))
  }, [selectedWorkspace, workspaces, setNodes])

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      container: ContainerBlock,
      leaf: LeafBlock,
    }),
    [],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!rf || !wrapperRef.current) return

      const blockDefJson = e.dataTransfer.getData('block-def')
      if (!blockDefJson) return

      const blockDef: BlockDef = JSON.parse(blockDefJson)
      const bounds = wrapperRef.current.getBoundingClientRect()
      const pos = rf.project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
      const id = `${blockDef.type}_${crypto.randomUUID().slice(0, 6)}`

      // Initialize field values with defaults
      const fieldValues: Record<string, string> = {}
      if (blockDef.fields) {
        for (const f of blockDef.fields) {
          fieldValues[f.name] = f.default ?? ''
        }
      }

      const newNode: Node = {
        id,
        type: blockDef.type,
        position: pos,
        data: {
          label: blockDef.name,
          blockName: blockDef.name,
          fields: blockDef.fields ?? [],
          fieldValues,
          ...(blockDef.block_type ? { block_type: blockDef.block_type } : {}),
          ...(blockDef.type === 'container' ? { childIds: [] } : {}),
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [rf, setNodes],
  )

  // Get absolute position of a node (accounting for parent chain)
  const getAbsolutePosition = useCallback(
    (node: Node): { x: number; y: number } => {
      let x = node.position.x
      let y = node.position.y
      let current = node
      while (current.parentNode) {
        const parent = nodes.find((n) => n.id === current.parentNode)
        if (!parent) break
        x += parent.position.x
        y += parent.position.y
        current = parent
      }
      return { x, y }
    },
    [nodes],
  )

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const dragPos = getAbsolutePosition(node)

      const getAncestorIds = (n: Node): Set<string> => {
        const ids = new Set<string>()
        let current = n
        while (current.parentNode) {
          ids.add(current.parentNode)
          const parent = nodes.find((nd) => nd.id === current.parentNode)
          if (!parent) break
          current = parent
        }
        return ids
      }
      const ancestorIds = getAncestorIds(node)

      const containers = nodes.filter(
        (n) => n.type === 'container' && n.id !== node.id && !ancestorIds.has(n.id),
      )

      const getDepth = (n: Node): number => {
        let depth = 0
        let current = n
        while (current.parentNode) {
          depth++
          const parent = nodes.find((nd) => nd.id === current.parentNode)
          if (!parent) break
          current = parent
        }
        return depth
      }
      containers.sort((a, b) => getDepth(b) - getDepth(a))

      for (const c of containers) {
        const containerAbsPos = getAbsolutePosition(c)
        const h = getNodeHeight(c, nodes)
        const w = getNodeWidth(c, nodes)
        const zone = {
          x: containerAbsPos.x,
          y: containerAbsPos.y + 36,
          width: w,
          height: h - 36,
        }
        if (isPointInRect(dragPos, zone)) {
          setHoveredContainerId(c.id)
          return
        }
      }
      setHoveredContainerId(null)
    },
    [nodes, getAbsolutePosition],
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setHoveredContainerId(null)

      const dragPos = getAbsolutePosition(node)

      const getAncestorIds = (n: Node): Set<string> => {
        const ids = new Set<string>()
        let current = n
        while (current.parentNode) {
          ids.add(current.parentNode)
          const parent = nodes.find((nd) => nd.id === current.parentNode)
          if (!parent) break
          current = parent
        }
        return ids
      }
      const ancestorIds = getAncestorIds(node)

      if (node.parentNode) {
        const parent = nodes.find((n) => n.id === node.parentNode)
        if (parent) {
          const parentAbsPos = getAbsolutePosition(parent)
          const h = getNodeHeight(parent, nodes)
          const w = getNodeWidth(parent, nodes)
          const zone = {
            x: parentAbsPos.x,
            y: parentAbsPos.y + 36,
            width: w,
            height: h - 36,
          }
          if (!isPointInRect(dragPos, zone)) {
            setNodes((prev) => {
              let next = detachChild(prev, node.id)
              next = relayoutChildren(next, parent.id)
              return next
            })
            return
          }
        }
      }

      const containers = nodes.filter(
        (n) => n.type === 'container' && n.id !== node.id && !ancestorIds.has(n.id),
      )

      const getDepth = (n: Node): number => {
        let depth = 0
        let current = n
        while (current.parentNode) {
          depth++
          const parent = nodes.find((nd) => nd.id === current.parentNode)
          if (!parent) break
          current = parent
        }
        return depth
      }
      containers.sort((a, b) => getDepth(b) - getDepth(a))

      for (const c of containers) {
        if (c.id === node.parentNode) continue

        const containerAbsPos = getAbsolutePosition(c)
        const h = getNodeHeight(c, nodes)
        const w = getNodeWidth(c, nodes)
        const zone = {
          x: containerAbsPos.x,
          y: containerAbsPos.y + 36,
          width: w,
          height: h - 36,
        }

        if (isPointInRect(dragPos, zone)) {
          setNodes((prev) => {
            // Check if this is a data_field being dropped into a Switch with empty "On" field
            const targetContainer = prev.find(n => n.id === c.id)
            const droppedNode = prev.find(n => n.id === node.id)
            
            if (targetContainer && droppedNode) {
              const isSwitch = targetContainer.data?.blockName === 'Switch'
              const isDataField = droppedNode.data?.block_type === 'data_field'
              const onFieldValue = (targetContainer.data?.fieldValues as Record<string, string>)?.On ?? ''
              
              // If dropping data_field into Switch with empty "On" field:
              // Just populate the field and remove the block (don't attach it)
              if (isSwitch && isDataField && onFieldValue.trim() === '') {
                const dataFieldName = droppedNode.data?.blockName as string
                
                // Detach from previous parent if any
                let next = node.parentNode ? detachChild(prev, node.id) : prev
                if (node.parentNode) {
                  next = relayoutChildren(next, node.parentNode)
                }
                
                // Update Switch "On" field and remove the dropped node
                next = next
                  .filter(n => n.id !== node.id) // Remove the dropped data_field node
                  .map(n => {
                    if (n.id === c.id) {
                      const fieldValues = { ...(n.data?.fieldValues as Record<string, string> ?? {}), On: dataFieldName }
                      return { ...n, data: { ...n.data, fieldValues } }
                    }
                    return n
                  })
                
                return next
              }
            }
            
            // Normal case: attach the child to the container
            let next = node.parentNode ? detachChild(prev, node.id) : prev
            if (node.parentNode) {
              next = relayoutChildren(next, node.parentNode)
            }
            next = attachChild(next, node.id, c.id)
            next = relayoutChildren(next, c.id)
            
            return next
          })
          return
        }
      }
    },
    [nodes, setNodes, getAbsolutePosition],
  )

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return

    setNodes((prev) => {
      const nodeToDelete = prev.find((n) => n.id === selectedNodeId)
      if (!nodeToDelete) return prev

      const getDescendantIds = (nodeId: string): string[] => {
        const node = prev.find((n) => n.id === nodeId)
        if (!node || node.type !== 'container') return []
        const childIds: string[] = (node.data?.childIds as string[]) ?? []
        const descendants: string[] = [...childIds]
        for (const cid of childIds) {
          descendants.push(...getDescendantIds(cid))
        }
        return descendants
      }
      const idsToRemove = new Set([selectedNodeId, ...getDescendantIds(selectedNodeId)])

      const parentId = nodeToDelete.parentNode
      let next = prev

      if (parentId) {
        next = next.map((n) => {
          if (n.id === parentId) {
            const ids = ((n.data?.childIds as string[]) ?? []).filter((id) => id !== selectedNodeId)
            return { ...n, data: { ...n.data, childIds: ids } }
          }
          return n
        })
      }

      next = next.filter((n) => !idsToRemove.has(n.id))

      if (parentId) {
        next = relayoutChildren(next, parentId)
      }

      return next
    })

    setSelectedNodeId(null)
  }, [selectedNodeId, setNodes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
        deleteSelectedNode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedNode])

  // Handle field value changes
  const updateFieldValue = useCallback(
    (nodeId: string, fieldName: string, value: string) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n
          const fieldValues = { ...(n.data?.fieldValues as Record<string, string> ?? {}), [fieldName]: value }
          return { ...n, data: { ...n.data, fieldValues } }
        }),
      )
    },
    [setNodes],
  )

  // Inject isHovered, computed dimensions, and updateFieldValue into nodes
  const nodesWithExtras = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      ...(n.type === 'container'
        ? {
            isHovered: n.id === hoveredContainerId,
            computedWidth: getNodeWidth(n, nodes),
            computedHeight: getNodeHeight(n, nodes),
          }
        : {}),
      onFieldChange: (fieldName: string, value: string) => updateFieldValue(n.id, fieldName, value),
    },
  }))

  // Export diagram to YAML (updates right pane) and generate PlanSpace
  const handleExport = useCallback(() => {
    const yaml = toYaml(nodes)
    setYamlContent(yaml)
    setYamlError(null)
    
    // Also generate PlanSpace YAML
    if (yaml.trim()) {
      const planspaceResult = flowToPlanSpace(yaml)
      if (planspaceResult.error) {
        setPlanspaceError(planspaceResult.error)
        setPlanspaceContent('')
      } else {
        setPlanspaceContent(planspaceResult.yaml)
        setPlanspaceError(null)
      }
    } else {
      setPlanspaceContent('')
      setPlanspaceError(null)
    }
  }, [nodes])

  // Import diagram from YAML (from right pane content)
  const handleImport = useCallback(() => {
    const result = fromYaml(yamlContent, blockDefs)
    if (result.error) {
      setYamlError(result.error)
      return
    }
    setNodes(result.nodes)
    setYamlError(null)
  }, [yamlContent, blockDefs, setNodes])

  // Group block definitions by type for the toolbox
  const containerDefs = blockDefs.filter((b) => b.type === 'container')
  const leafDefs = blockDefs.filter((b) => b.type === 'leaf')

  // Flow management functions
  const loadFlows = useCallback(async () => {
    try {
      const flows = await listFlows()
      setSavedFlows(flows)
    } catch (err) {
      console.error('Failed to load flows:', err)
    }
  }, [])

  const handleNewFlow = useCallback(() => {
    setCurrentFlow(null)
    setFlowName('')
    setFlowExternalId('')
    setNodes([])
    setYamlContent('')
    setPlanspaceContent('')
    setFlowMessage({ type: 'success', text: 'New flow created' })
    setTimeout(() => setFlowMessage(null), 3000)
  }, [setNodes])

  const handleOpenFlow = useCallback(async () => {
    await loadFlows()
    setShowOpenModal(true)
  }, [loadFlows])

  const handleSelectFlow = useCallback((flow: Flow) => {
    setCurrentFlow(flow)
    setFlowName(flow.name)
    setFlowExternalId(flow.external_id || '')
    setYamlContent(flow.flow_yaml || '')
    setPlanspaceContent(flow.plan_yaml || '')
    setShowOpenModal(false)
    
    // Import the flow YAML to canvas
    if (flow.flow_yaml) {
      const result = fromYaml(flow.flow_yaml, blockDefs)
      if (!result.error) {
        setNodes(result.nodes)
      }
    }
    
    setFlowMessage({ type: 'success', text: `Loaded: ${flow.name}` })
    setTimeout(() => setFlowMessage(null), 3000)
  }, [blockDefs, setNodes])

  const handleSaveFlow = useCallback(async () => {
    if (!flowName.trim()) {
      setFlowMessage({ type: 'error', text: 'Flow name is required' })
      setTimeout(() => setFlowMessage(null), 3000)
      return
    }

    // Export current canvas to YAML
    const flowYaml = toYaml(nodes)
    const planspaceResult = flowToPlanSpace(flowYaml)
    const planYaml = planspaceResult.yaml

    try {
      if (currentFlow) {
        // Update existing flow
        const updated = await updateFlow(currentFlow.id, {
          name: flowName,
          external_id: flowExternalId || null,
          flow_yaml: flowYaml,
          plan_yaml: planYaml,
        })
        setCurrentFlow(updated)
        setFlowMessage({ type: 'success', text: 'Flow saved!' })
      } else {
        // Create new flow
        const created = await createFlow({
          name: flowName,
          external_id: flowExternalId || null,
          flow_yaml: flowYaml,
          plan_yaml: planYaml,
        })
        setCurrentFlow(created)
        setFlowMessage({ type: 'success', text: 'Flow created!' })
      }
      
      // Update YAML panes
      setYamlContent(flowYaml)
      setPlanspaceContent(planYaml)
    } catch (err: any) {
      setFlowMessage({ type: 'error', text: err.message || 'Failed to save flow' })
    }
    setTimeout(() => setFlowMessage(null), 3000)
  }, [currentFlow, flowName, flowExternalId, nodes])

  const handleDeleteFlow = useCallback(async () => {
    if (!currentFlow) {
      setFlowMessage({ type: 'error', text: 'No flow to delete' })
      setTimeout(() => setFlowMessage(null), 3000)
      return
    }

    if (!window.confirm(`Delete flow "${currentFlow.name}"?`)) return

    try {
      await deleteFlowApi(currentFlow.id)
      handleNewFlow()
      setFlowMessage({ type: 'success', text: 'Flow deleted' })
    } catch (err: any) {
      setFlowMessage({ type: 'error', text: err.message || 'Failed to delete flow' })
    }
    setTimeout(() => setFlowMessage(null), 3000)
  }, [currentFlow, handleNewFlow])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Ribbon */}
      <header
        style={{
          height: 48,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            padding: '6px 10px',
            background: 'var(--btn-neutral)',
            border: 'none',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

        {/* Flow Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleNewFlow}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            New
          </button>
          <button
            onClick={handleOpenFlow}
            style={{
              padding: '6px 12px',
              background: '#6366f1',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Open
          </button>
          <button
            onClick={handleSaveFlow}
            style={{
              padding: '6px 12px',
              background: '#10b981',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={handleDeleteFlow}
            style={{
              padding: '6px 12px',
              background: '#ef4444',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

        {/* Flow Name Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Name:</label>
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="Flow name"
            style={{
              width: 180,
              padding: '6px 10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 4,
              color: 'var(--input-text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>

        {/* External ID Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>External ID:</label>
          <input
            type="text"
            value={flowExternalId}
            onChange={(e) => setFlowExternalId(e.target.value)}
            placeholder="Optional"
            style={{
              width: 140,
              padding: '6px 10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 4,
              color: 'var(--input-text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>

        {/* Status indicator */}
        {currentFlow && (
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            ID: {currentFlow.id}
          </span>
        )}

        {/* Message */}
        {flowMessage && (
          <span
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              background: flowMessage.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
              color: flowMessage.type === 'success' ? 'var(--success-text)' : 'var(--error-text)',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {flowMessage.text}
          </span>
        )}
      </header>

      {/* Open Flow Modal */}
      {showOpenModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowOpenModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              padding: 24,
              width: 500,
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: 'var(--text-primary)', margin: '0 0 16px', fontSize: 18 }}>Open Flow</h2>
            {savedFlows.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No saved flows found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedFlows.map((flow) => (
                  <button
                    key={flow.id}
                    onClick={() => handleSelectFlow(flow)}
                    style={{
                      padding: '12px 16px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{flow.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {flow.external_id && <span>ID: {flow.external_id} • </span>}
                      Updated: {new Date(flow.updated_at).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowOpenModal(false)}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: 'var(--btn-neutral)',
                border: 'none',
                borderRadius: 4,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Toolbox */}
      <aside
        style={{
          width: 200,
          padding: 16,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflowY: 'auto',
        }}
      >
        {/* Workspace Dropdown */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 6 }}>
            Workspace
          </label>
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--input-text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {workspaces.map((ws) => (
              <option key={ws.name} value={ws.name}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 8 }} />

        <div style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Containers</div>
        {containerDefs.map((def, idx) => (
          <div
            key={`${def.name}-${idx}`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('block-def', JSON.stringify(def))}
            style={{
              padding: '8px 12px',
              background: 'var(--container-bg)',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'grab',
            }}
          >
            {def.name}
          </div>
        ))}

        <div style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 14, marginTop: 12, marginBottom: 4 }}>Leaves</div>
        {leafDefs.map((def, idx) => (
          <div
            key={`${def.name}-${idx}`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('block-def', JSON.stringify(def))}
            style={{
              padding: '8px 12px',
              background: 'var(--leaf-bg)',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'grab',
            }}
          >
            {def.name}
          </div>
        ))}

        <div style={{ marginTop: 'auto', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Press Delete to remove selected.
        </div>
      </aside>

      {/* Canvas */}
      <div ref={wrapperRef} style={{ flex: 1, background: 'var(--bg-primary)' }}>
        <ReactFlow
          nodes={nodesWithExtras}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          onInit={setRf}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--canvas-grid)" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      {/* YAML Pane with Tabs */}
      <aside
        style={{
          width: 350,
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Tab Headers */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => setActiveTab('flow')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === 'flow' ? 'var(--tab-active-bg)' : 'var(--tab-inactive-bg)',
              border: 'none',
              borderBottom: activeTab === 'flow' ? '2px solid var(--tab-border-flow)' : '2px solid transparent',
              color: activeTab === 'flow' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Flow YAML
          </button>
          <button
            onClick={() => setActiveTab('planspace')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === 'planspace' ? 'var(--tab-active-bg)' : 'var(--tab-inactive-bg)',
              border: 'none',
              borderBottom: activeTab === 'planspace' ? '2px solid var(--tab-border-plan)' : '2px solid transparent',
              color: activeTab === 'planspace' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            PlanSpace
          </button>
        </div>

        {/* Flow YAML Tab Content */}
        {activeTab === 'flow' && (
          <>
            {/* Action Buttons */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: 8,
              }}
            >
              <button
                onClick={handleExport}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#4f46e5',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Export
              </button>
              <button
                onClick={handleImport}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#059669',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Import
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={yamlContent}
              onChange={(e) => {
                setYamlContent(e.target.value)
                setYamlError(null)
              }}
              placeholder="Click Export to generate YAML from diagram, or paste YAML here and click Import..."
              style={{
                flex: 1,
                padding: 12,
                background: 'var(--bg-tertiary)',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 11,
                resize: 'none',
                outline: 'none',
              }}
            />

            {/* Error display */}
            {yamlError && (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--error-bg)',
                  borderTop: '1px solid var(--error-text)',
                  color: 'var(--error-text)',
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                {yamlError}
              </div>
            )}
          </>
        )}

        {/* PlanSpace Tab Content */}
        {activeTab === 'planspace' && (
          <>
            {/* Info Header */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(139,92,246,0.1)',
              }}
            >
              <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 500 }}>
                Generated from Flow YAML • Click Export to update
              </span>
            </div>

            {/* PlanSpace YAML Display */}
            <textarea
              value={planspaceContent}
              readOnly
              placeholder="Export the Flow YAML to generate the PlanSpace..."
              style={{
                flex: 1,
                padding: 12,
                background: 'var(--bg-tertiary)',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 11,
                resize: 'none',
                outline: 'none',
              }}
            />

            {/* Error display */}
            {planspaceError && (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--error-bg)',
                  borderTop: '1px solid var(--error-text)',
                  color: 'var(--error-text)',
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                {planspaceError}
              </div>
            )}

            {/* Copy button */}
            {planspaceContent && (
              <div
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  onClick={() => navigator.clipboard.writeText(planspaceContent)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#8b5cf6',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Copy PlanSpace YAML
                </button>
              </div>
            )}
          </>
        )}
      </aside>
      </div>
    </div>
  )
}
