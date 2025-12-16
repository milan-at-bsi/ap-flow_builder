import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'protocol_builder',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

export interface Flow {
  id: number
  name: string
  external_id: string | null
  flow_yaml: string | null
  plan_yaml: string | null
  created_at: Date
  updated_at: Date
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

// Get all flows
export async function getAllFlows(): Promise<Flow[]> {
  const result = await pool.query(
    'SELECT * FROM flows ORDER BY updated_at DESC'
  )
  return result.rows
}

// Get flow by ID
export async function getFlowById(id: number): Promise<Flow | null> {
  const result = await pool.query(
    'SELECT * FROM flows WHERE id = $1',
    [id]
  )
  return result.rows[0] || null
}

// Get flow by external_id
export async function getFlowByExternalId(externalId: string): Promise<Flow | null> {
  const result = await pool.query(
    'SELECT * FROM flows WHERE external_id = $1',
    [externalId]
  )
  return result.rows[0] || null
}

// Create new flow
export async function createFlow(input: CreateFlowInput): Promise<Flow> {
  const result = await pool.query(
    `INSERT INTO flows (name, external_id, flow_yaml, plan_yaml)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.name, input.external_id || null, input.flow_yaml || null, input.plan_yaml || null]
  )
  return result.rows[0]
}

// Update flow
export async function updateFlow(id: number, input: UpdateFlowInput): Promise<Flow | null> {
  const fields: string[] = []
  const values: any[] = []
  let paramCount = 1

  if (input.name !== undefined) {
    fields.push(`name = $${paramCount++}`)
    values.push(input.name)
  }
  if (input.external_id !== undefined) {
    fields.push(`external_id = $${paramCount++}`)
    values.push(input.external_id)
  }
  if (input.flow_yaml !== undefined) {
    fields.push(`flow_yaml = $${paramCount++}`)
    values.push(input.flow_yaml)
  }
  if (input.plan_yaml !== undefined) {
    fields.push(`plan_yaml = $${paramCount++}`)
    values.push(input.plan_yaml)
  }

  if (fields.length === 0) {
    return getFlowById(id)
  }

  fields.push(`updated_at = NOW()`)
  values.push(id)

  const result = await pool.query(
    `UPDATE flows SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  )
  return result.rows[0] || null
}

// Delete flow
export async function deleteFlow(id: number): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM flows WHERE id = $1',
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  } catch (err) {
    console.error('Database connection failed:', err)
    return false
  }
}

export default pool
