import type { Node } from 'reactflow'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import { relayoutChildren } from './layout'

// Types matching block_definitions.yaml structure
type FieldDef = { name: string; default?: string; options?: string[] }
type BlockDef = { type: 'container' | 'leaf'; name: string; block_type?: string; fields?: FieldDef[] }

// Compact YAML structure - block name as key
type CompactBlock = {
  [blockName: string]: CompactBlockContent | CompactBlock[] | string | null
}

type CompactBlockContent = Record<string, string | CompactBlock[]>

// Legacy YAML structure for backward compatibility
interface LegacyDiagramBlockYaml {
  type: 'container' | 'leaf'
  name: string
  fields?: Record<string, string>
  children?: LegacyDiagramBlockYaml[]
}

/**
 * Export nodes to compact YAML string
 * Format: BlockName: { field1: value1, ... } with children as list items
 */
export function toYaml(nodes: Node[]): string {
  // Find root nodes (no parent)
  const rootNodes = nodes.filter((n) => !n.parentNode)
  
  // Sort roots by Y position (top to bottom stacking order)
  rootNodes.sort((a, b) => a.position.y - b.position.y)

  const buildCompactBlock = (node: Node): CompactBlock => {
    const blockName = (node.data?.blockName as string) ?? (node.data?.label as string) ?? 'Unknown'
    const fieldValues = (node.data?.fieldValues as Record<string, string>) ?? {}
    const blockType = node.type as 'container' | 'leaf'
    const blockTypeAttr = node.data?.block_type as string | undefined

    // Special handling for data_field blocks: output as { data_field: block_name }
    if (blockTypeAttr === 'data_field') {
      return { data_field: blockName }
    }

    // Build the content object with fields
    const content: CompactBlockContent = {}
    
    // Add block_type if it exists (important metadata for PlanSpace) - except for data_field
    if (blockTypeAttr && blockTypeAttr !== 'data_field') {
      content['block_type'] = blockTypeAttr
    }
    
    // Add non-empty fields directly
    for (const [k, v] of Object.entries(fieldValues)) {
      if (v && v.trim() !== '') {
        content[k] = v
      }
    }

    // For leaves, check if we can simplify to direct value
    // If the only non-empty field has the same name as the block, use direct value
    if (blockType === 'leaf') {
      const nonEmptyFields = Object.entries(content)
      if (nonEmptyFields.length === 1 && nonEmptyFields[0][0] === blockName) {
        // Simplify: { intent: { intent: "collect" } } -> { intent: "collect" }
        return { [blockName]: nonEmptyFields[0][1] as string }
      }
    }

    // For containers, add children as list items
    if (blockType === 'container') {
      const childIds: string[] = (node.data?.childIds as string[]) ?? []
      if (childIds.length > 0) {
        // Get children and sort by position (stacking order)
        const children = childIds
          .map((id) => nodes.find((n) => n.id === id))
          .filter((n): n is Node => n !== undefined)
          .sort((a, b) => a.position.y - b.position.y)
        
        // Children become an array in the content
        const childBlocks = children.map(buildCompactBlock)
        
        // If we have fields and children, we need to merge them
        // Children go into the array under the block name
        if (Object.keys(content).length > 0) {
          // Return as object with fields and children array merged
          return { [blockName]: [...Object.entries(content).map(([k, v]) => ({ [k]: v })), ...childBlocks] as any }
        } else {
          // Just children, no fields
          return { [blockName]: childBlocks }
        }
      }
    }

    // Return block with fields (or empty object if no fields)
    if (Object.keys(content).length > 0) {
      return { [blockName]: content }
    } else {
      return { [blockName]: null } as any
    }
  }

  // Build the diagram structure
  // For a single root, use it directly; for multiple roots, use an array
  if (rootNodes.length === 1) {
    const rootBlock = buildCompactBlock(rootNodes[0])
    const diagram = { diagram: rootBlock }
    return stringifyYaml(diagram, { indent: 2 })
  } else if (rootNodes.length > 1) {
    const rootBlocks = rootNodes.map(buildCompactBlock)
    const diagram = { diagram: rootBlocks }
    return stringifyYaml(diagram, { indent: 2 })
  } else {
    return stringifyYaml({ diagram: {} }, { indent: 2 })
  }
}

/**
 * Import nodes from YAML string (supports both compact and legacy formats)
 */
export function fromYaml(
  yamlStr: string,
  blockDefs: BlockDef[],
): { nodes: Node[]; error?: string } {
  try {
    const parsed = parseYaml(yamlStr)
    
    if (!parsed || !parsed.diagram) {
      return { nodes: [], error: 'Invalid YAML: missing "diagram" key' }
    }

    const nodes: Node[] = []
    let idCounter = 0

    const generateId = (type: string): string => {
      idCounter++
      return `${type}_import_${idCounter}`
    }

    // Find block definition by name
    const findBlockDef = (name: string): BlockDef | undefined => {
      return blockDefs.find((d) => d.name === name)
    }

    // Check if a key is a known block name
    const isBlockName = (key: string): boolean => {
      return blockDefs.some((d) => d.name === key)
    }

    // Check if we're dealing with legacy format
    const isLegacyFormat = (obj: any): boolean => {
      if (Array.isArray(obj)) {
        return obj.length > 0 && obj[0] && typeof obj[0].type === 'string' && typeof obj[0].name === 'string'
      }
      return false
    }

    // Parse legacy format block
    const parseLegacyBlock = (
      block: LegacyDiagramBlockYaml,
      parentId: string | undefined,
    ): { node: Node; height: number } | { error: string } => {
      const def = blockDefs.find((d) => d.type === block.type && d.name === block.name)
      if (!def) {
        return { error: `Unknown block: type="${block.type}", name="${block.name}"` }
      }

      const id = generateId(block.type)
      
      const fieldValues: Record<string, string> = {}
      if (def.fields) {
        for (const f of def.fields) {
          fieldValues[f.name] = block.fields?.[f.name] ?? ''
        }
      }

      const node: Node = {
        id,
        type: block.type,
        position: { x: 0, y: 0 },
        data: {
          label: block.name,
          blockName: block.name,
          fields: def.fields ?? [],
          fieldValues,
          ...(block.type === 'container' ? { childIds: [] } : {}),
        },
        ...(parentId ? { parentNode: parentId, extent: 'parent' as const } : {}),
      }

      nodes.push(node)

      if (block.type === 'container' && block.children && block.children.length > 0) {
        const childIds: string[] = []
        
        for (const childBlock of block.children) {
          const result = parseLegacyBlock(childBlock, id)
          if ('error' in result) {
            return result
          }
          childIds.push(result.node.id)
        }

        node.data = { ...node.data, childIds }
      }

      return { node, height: 0 }
    }

    // Parse compact format block
    const parseCompactBlock = (
      blockObj: CompactBlock,
      parentId: string | undefined,
    ): { node: Node } | { error: string } => {
      // Get the block name (the key of the object)
      const keys = Object.keys(blockObj)
      if (keys.length !== 1) {
        return { error: `Invalid block structure: expected single key, got ${keys.length}` }
      }

      let blockName = keys[0]
      const content = blockObj[blockName]
      
      // Special handling for data_field format: { data_field: "vehicle_type" }
      if (blockName === 'data_field' && typeof content === 'string') {
        // The actual block name is the value
        const actualBlockName = content
        const def = findBlockDef(actualBlockName)
        
        if (!def) {
          return { error: `Unknown data_field block: "${actualBlockName}"` }
        }
        
        const id = generateId(def.type)
        
        const node: Node = {
          id,
          type: def.type,
          position: { x: 0, y: 0 },
          data: {
            label: actualBlockName,
            blockName: actualBlockName,
            fields: def.fields ?? [],
            fieldValues: {},
            ...(def.block_type ? { block_type: def.block_type } : {}),
            ...(def.type === 'container' ? { childIds: [] } : {}),
          },
          ...(parentId ? { parentNode: parentId, extent: 'parent' as const } : {}),
        }

        nodes.push(node)
        return { node }
      }

      const def = findBlockDef(blockName)
      
      if (!def) {
        return { error: `Unknown block: "${blockName}"` }
      }

      const id = generateId(def.type)
      
      // Initialize field values
      const fieldValues: Record<string, string> = {}
      if (def.fields) {
        for (const f of def.fields) {
          fieldValues[f.name] = ''
        }
      }

      const childIds: string[] = []

      // Parse content - can be string (direct value), object with fields, array with children, or null
      if (content === null || content === undefined) {
        // No fields or children
      } else if (typeof content === 'string') {
        // Direct value format: { intent: "collect" } means field "intent" = "collect"
        // The field name is the same as the block name
        fieldValues[blockName] = content
      } else if (Array.isArray(content)) {
        // Array of children (and possibly field objects)
        for (const item of content) {
          if (typeof item === 'object' && item !== null) {
            const itemKeys = Object.keys(item)
            if (itemKeys.length === 1) {
              const itemKey = itemKeys[0]
              const itemValue = (item as any)[itemKey]
              
              // PRIORITY: Check if this is a block name FIRST (block takes priority over field)
              // Also handle special data_field format: { data_field: "vehicle_type" }
              if (itemKey === 'data_field' && typeof itemValue === 'string') {
                // It's a data_field child block
                const result = parseCompactBlock(item as CompactBlock, id)
                if ('error' in result) {
                  return result
                }
                childIds.push(result.node.id)
              } else if (isBlockName(itemKey)) {
                // It's a child block
                const result = parseCompactBlock(item as CompactBlock, id)
                if ('error' in result) {
                  return result
                }
                childIds.push(result.node.id)
              } else if (def.fields?.some(f => f.name === itemKey) && typeof itemValue === 'string') {
                // It's a field on the container (only if NOT a block name)
                fieldValues[itemKey] = itemValue as string
              } else {
                // Unknown key - might be a field not in definition, store it anyway
                if (typeof itemValue === 'string') {
                  fieldValues[itemKey] = itemValue
                }
              }
            }
          }
        }
      } else if (typeof content === 'object') {
        // Object with fields (and possibly children array under special handling)
        for (const [key, value] of Object.entries(content)) {
          if (typeof value === 'string') {
            // It's a field
            fieldValues[key] = value
          } else if (Array.isArray(value) && isBlockName(key)) {
            // Nested container with children
            // This shouldn't happen in our format, but handle it
          }
        }
      }

      const node: Node = {
        id,
        type: def.type,
        position: { x: 0, y: 0 },
        data: {
          label: blockName,
          blockName: blockName,
          fields: def.fields ?? [],
          fieldValues,
          ...(def.block_type ? { block_type: def.block_type } : {}),
          ...(def.type === 'container' ? { childIds } : {}),
        },
        ...(parentId ? { parentNode: parentId, extent: 'parent' as const } : {}),
      }

      nodes.push(node)

      return { node }
    }

    // Determine format and parse
    const diagram = parsed.diagram

    if (isLegacyFormat(diagram)) {
      // Legacy format: array of { type, name, fields, children }
      for (const rootBlock of diagram as LegacyDiagramBlockYaml[]) {
        const result = parseLegacyBlock(rootBlock, undefined)
        if ('error' in result) {
          return { nodes: [], error: result.error }
        }
      }
    } else if (Array.isArray(diagram)) {
      // Compact format: array of compact blocks
      for (const rootBlock of diagram) {
        const result = parseCompactBlock(rootBlock, undefined)
        if ('error' in result) {
          return { nodes: [], error: result.error }
        }
      }
    } else if (typeof diagram === 'object' && diagram !== null) {
      // Single compact block (most common case)
      const result = parseCompactBlock(diagram as CompactBlock, undefined)
      if ('error' in result) {
        return { nodes: [], error: result.error }
      }
    } else {
      return { nodes: [], error: 'Invalid diagram format' }
    }

    // Position root nodes vertically
    let yPos = 50
    const rootNodesList = nodes.filter((n) => !n.parentNode)
    for (const root of rootNodesList) {
      root.position = { x: 50, y: yPos }
      yPos += 200
    }

    // Relayout children for all containers
    // Process containers from deepest to shallowest for proper layout
    let updatedNodes = nodes
    const containers = nodes.filter((n) => n.type === 'container')
    
    // Sort containers by depth (deepest first) so nested children are laid out before parents
    const getDepth = (nodeId: string): number => {
      const node = nodes.find(n => n.id === nodeId)
      if (!node?.parentNode) return 0
      return 1 + getDepth(node.parentNode)
    }
    containers.sort((a, b) => getDepth(b.id) - getDepth(a.id))
    
    for (const container of containers) {
      updatedNodes = relayoutChildren(updatedNodes, container.id)
    }
    
    // Sort nodes so parents come before children (React Flow requirement)
    const sortedNodes: Node[] = []
    const addedIds = new Set<string>()
    
    const addNodeWithParents = (node: Node) => {
      if (addedIds.has(node.id)) return
      // Add parent first
      if (node.parentNode) {
        const parent = updatedNodes.find(n => n.id === node.parentNode)
        if (parent) addNodeWithParents(parent)
      }
      sortedNodes.push(node)
      addedIds.add(node.id)
    }
    
    // Add all nodes, ensuring parents come before children
    for (const node of updatedNodes) {
      addNodeWithParents(node)
    }

    return { nodes: sortedNodes }
  } catch (err) {
    return { nodes: [], error: `YAML parse error: ${err}` }
  }
}
