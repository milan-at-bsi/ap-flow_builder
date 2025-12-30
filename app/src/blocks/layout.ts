import type { Node } from 'reactflow'

const HEADER = 36
const PADDING = 12
const GAP = 8
const DROP_ZONE_H = 50
const MIN_WIDTH = 220
const LEAF_H = 44
const LEAF_HEADER_H = 32
const LEAF_PADDING = 8
const CONTAINER_BASE_W = 220
const FIELD_ROW_H = 28

// Get fields height for a node
function getFieldsHeight(node: Node): number {
  const fields = (node.data?.fields as { name: string }[]) ?? []
  return fields.length > 0 ? fields.length * FIELD_ROW_H + 8 : 0
}

// Check if children should be laid out horizontally
function hasHorizontalChildren(node: Node, allNodes: Node[]): boolean {
  if (node.type !== 'container') return false
  const childIds: string[] = (node.data?.childIds as string[]) ?? []
  if (childIds.length === 0) return false
  
  // Check if any child has map_placement: horizontal
  for (const cid of childIds) {
    const child = allNodes.find((n) => n.id === cid)
    if (child?.data?.map_placement === 'horizontal') {
      return true
    }
  }
  return false
}

// Get the height of a node (leaf or container)
export function getNodeHeight(node: Node, allNodes: Node[]): number {
  if (node.type === 'leaf') {
    const fields = (node.data?.fields as { name: string }[]) ?? []
    if (fields.length > 0) {
      return LEAF_HEADER_H + fields.length * FIELD_ROW_H + LEAF_PADDING * 2
    }
    return LEAF_H
  }
  // Container: compute based on children
  const childIds: string[] = (node.data?.childIds as string[]) ?? []
  const fieldsH = getFieldsHeight(node)
  if (childIds.length === 0) return HEADER + fieldsH + PADDING * 2 + DROP_ZONE_H

  // Check if children should be laid out horizontally
  const isHorizontal = hasHorizontalChildren(node, allNodes)

  if (isHorizontal) {
    // For horizontal layout, use the max child height
    let maxChildH = 0
    for (const cid of childIds) {
      const child = allNodes.find((n) => n.id === cid)
      if (child) maxChildH = Math.max(maxChildH, getNodeHeight(child, allNodes))
    }
    return HEADER + fieldsH + PADDING * 2 + maxChildH + GAP + DROP_ZONE_H
  } else {
    // For vertical layout, sum all child heights
    let totalChildH = 0
    for (const cid of childIds) {
      const child = allNodes.find((n) => n.id === cid)
      if (child) totalChildH += getNodeHeight(child, allNodes)
    }
    return HEADER + fieldsH + PADDING * 2 + totalChildH + childIds.length * GAP + DROP_ZONE_H
  }
}

// Get the width of a node
export function getNodeWidth(node: Node, allNodes: Node[]): number {
  if (node.type === 'leaf') return 180
  // Container: compute based on children
  const childIds: string[] = (node.data?.childIds as string[]) ?? []
  if (childIds.length === 0) return CONTAINER_BASE_W

  // Check if children should be laid out horizontally
  const isHorizontal = hasHorizontalChildren(node, allNodes)

  if (isHorizontal) {
    // For horizontal layout, sum all child widths + gaps
    let totalChildW = 0
    for (const cid of childIds) {
      const child = allNodes.find((n) => n.id === cid)
      if (child) totalChildW += getNodeWidth(child, allNodes)
    }
    return Math.max(MIN_WIDTH, totalChildW + (childIds.length - 1) * GAP + PADDING * 2)
  } else {
    // For vertical layout, use the widest child
    let maxChildW = 0
    for (const cid of childIds) {
      const child = allNodes.find((n) => n.id === cid)
      if (child) maxChildW = Math.max(maxChildW, getNodeWidth(child, allNodes))
    }
    return Math.max(MIN_WIDTH, maxChildW + PADDING * 2)
  }
}

export function getContainerDropZone(container: Node, allNodes: Node[]) {
  const h = getNodeHeight(container, allNodes)
  const w = getNodeWidth(container, allNodes)
  return {
    x: container.position.x,
    y: container.position.y + HEADER,
    width: w,
    height: h - HEADER,
  }
}

export function isPointInRect(pt: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }) {
  return pt.x >= rect.x && pt.x <= rect.x + rect.width && pt.y >= rect.y && pt.y <= rect.y + rect.height
}

export function attachChild(nodes: Node[], childId: string, containerId: string): Node[] {
  return nodes.map((n) => {
    if (n.id === containerId) {
      const ids = (n.data?.childIds as string[]) ?? []
      if (!ids.includes(childId)) {
        return { ...n, data: { ...n.data, childIds: [...ids, childId] } }
      }
    }
    if (n.id === childId) {
      return { ...n, parentNode: containerId, extent: 'parent' as const }
    }
    return n
  })
}

export function detachChild(nodes: Node[], childId: string): Node[] {
  let parentId: string | undefined
  const child = nodes.find((n) => n.id === childId)
  if (child?.parentNode) parentId = child.parentNode

  return nodes.map((n) => {
    if (n.id === parentId) {
      const ids = ((n.data?.childIds as string[]) ?? []).filter((id) => id !== childId)
      return { ...n, data: { ...n.data, childIds: ids } }
    }
    if (n.id === childId) {
      const { parentNode, extent, ...rest } = n as Node & { extent?: unknown }
      // Convert child position to absolute
      const parent = nodes.find((p) => p.id === parentId)
      const absX = (parent?.position.x ?? 0) + n.position.x
      const absY = (parent?.position.y ?? 0) + n.position.y
      return { ...rest, position: { x: absX, y: absY } } as Node
    }
    return n
  })
}

export function relayoutChildren(nodes: Node[], containerId: string): Node[] {
  const container = nodes.find((n) => n.id === containerId)
  if (!container) return nodes

  const childIds: string[] = (container.data?.childIds as string[]) ?? []
  const fieldsH = getFieldsHeight(container)
  const startY = HEADER + fieldsH + PADDING

  // Check if children should be laid out horizontally
  const isHorizontal = hasHorizontalChildren(container, nodes)

  if (isHorizontal) {
    // Horizontal layout: position children side-by-side
    return nodes.map((n) => {
      const idx = childIds.indexOf(n.id)
      if (idx === -1) return n
      // Calculate x based on widths of previous children
      let xPos = PADDING
      for (let i = 0; i < idx; i++) {
        const prevChild = nodes.find((nd) => nd.id === childIds[i])
        if (prevChild) xPos += getNodeWidth(prevChild, nodes) + GAP
      }
      return { ...n, position: { x: xPos, y: startY } }
    })
  } else {
    // Vertical layout: position children stacked
    return nodes.map((n) => {
      const idx = childIds.indexOf(n.id)
      if (idx === -1) return n
      // Calculate y based on heights of previous children
      let yPos = startY
      for (let i = 0; i < idx; i++) {
        const prevChild = nodes.find((nd) => nd.id === childIds[i])
        if (prevChild) yPos += getNodeHeight(prevChild, nodes) + GAP
      }
      return { ...n, position: { x: PADDING, y: yPos } }
    })
  }
}
