// API client for flows

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface Flow {
  id: number
  name: string
  external_id: string | null
  flow_yaml: string | null
  plan_yaml: string | null
  created_at: string
  updated_at: string
}

export interface CreateFlowInput {
  name: string
  external_id?: string | null
  flow_yaml?: string | null
  plan_yaml?: string | null
}

export interface UpdateFlowInput {
  name?: string
  external_id?: string | null
  flow_yaml?: string | null
  plan_yaml?: string | null
}

// List all flows
export async function listFlows(): Promise<Flow[]> {
  const res = await fetch(`${API_BASE}/api/flows`)
  if (!res.ok) throw new Error('Failed to fetch flows')
  return res.json()
}

// Get flow by ID
export async function getFlow(id: number): Promise<Flow> {
  const res = await fetch(`${API_BASE}/api/flows/${id}`)
  if (!res.ok) throw new Error('Failed to fetch flow')
  return res.json()
}

// Get flow by external_id
export async function getFlowByExternalId(externalId: string): Promise<Flow | null> {
  const res = await fetch(`${API_BASE}/api/flows?external_id=${encodeURIComponent(externalId)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch flow')
  return res.json()
}

// Create new flow
export async function createFlow(input: CreateFlowInput): Promise<Flow> {
  const res = await fetch(`${API_BASE}/api/flows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create flow')
  }
  return res.json()
}

// Update flow
export async function updateFlow(id: number, input: UpdateFlowInput): Promise<Flow> {
  const res = await fetch(`${API_BASE}/api/flows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to update flow')
  }
  return res.json()
}

// Delete flow
export async function deleteFlow(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/flows/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete flow')
}
