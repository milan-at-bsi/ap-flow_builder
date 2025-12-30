import { Router, Request, Response } from 'express'
import {
  getAllFlows,
  getFlowById,
  getFlowByExternalId,
  createFlow,
  updateFlow,
  deleteFlow,
} from '../db'

const router = Router()

// GET /api/flows - List all flows or filter by external_id
router.get('/', async (req: Request, res: Response) => {
  try {
    const { external_id } = req.query

    if (external_id && typeof external_id === 'string') {
      const flow = await getFlowByExternalId(external_id)
      if (!flow) {
        return res.status(404).json({ error: 'Flow not found' })
      }
      return res.json(flow)
    }

    const flows = await getAllFlows()
    res.json(flows)
  } catch (err) {
    console.error('Error fetching flows:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/flows/external/:externalId - Get flow by external ID
router.get('/external/:externalId', async (req: Request, res: Response) => {
  try {
    const { externalId } = req.params
    if (!externalId) {
      return res.status(400).json({ error: 'External ID is required' })
    }

    const flow = await getFlowByExternalId(externalId)
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.json(flow)
  } catch (err) {
    console.error('Error fetching flow by external ID:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/flows/:id - Get flow by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid flow ID' })
    }

    const flow = await getFlowById(id)
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.json(flow)
  } catch (err) {
    console.error('Error fetching flow:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/flows - Create new flow
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, external_id, flow_yaml, plan_yaml } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' })
    }

    const flow = await createFlow({
      name,
      external_id: external_id || null,
      flow_yaml: flow_yaml || null,
      plan_yaml: plan_yaml || null,
    })

    res.status(201).json(flow)
  } catch (err: any) {
    console.error('Error creating flow:', err)
    if (err.code === '23505') {
      // Unique constraint violation
      return res.status(409).json({ error: 'External ID already exists' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/flows/:id - Update flow
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid flow ID' })
    }

    const { name, external_id, flow_yaml, plan_yaml } = req.body

    const flow = await updateFlow(id, {
      name,
      external_id,
      flow_yaml,
      plan_yaml,
    })

    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.json(flow)
  } catch (err: any) {
    console.error('Error updating flow:', err)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'External ID already exists' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/flows/:id - Delete flow
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid flow ID' })
    }

    const deleted = await deleteFlow(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.status(204).send()
  } catch (err) {
    console.error('Error deleting flow:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/flows/:id/flow.yaml - Get raw flow YAML by ID
router.get('/:id/flow.yaml', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid flow ID' })
    }

    const flow = await getFlowById(id)
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.setHeader('Content-Type', 'text/yaml')
    res.send(flow.flow_yaml || '')
  } catch (err) {
    console.error('Error fetching flow YAML:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/flows/:id/planspace.yaml - Get raw PlanSpace YAML by ID
router.get('/:id/planspace.yaml', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid flow ID' })
    }

    const flow = await getFlowById(id)
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.setHeader('Content-Type', 'text/yaml')
    res.send(flow.plan_yaml || '')
  } catch (err) {
    console.error('Error fetching PlanSpace YAML:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/flows/external/:externalId/flow.yaml - Get raw flow YAML by external ID
router.get('/external/:externalId/flow.yaml', async (req: Request, res: Response) => {
  try {
    const { externalId } = req.params
    if (!externalId) {
      return res.status(400).json({ error: 'External ID is required' })
    }

    const flow = await getFlowByExternalId(externalId)
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.setHeader('Content-Type', 'text/yaml')
    res.send(flow.flow_yaml || '')
  } catch (err) {
    console.error('Error fetching flow YAML by external ID:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/flows/external/:externalId/planspace.yaml - Get raw PlanSpace YAML by external ID
router.get('/external/:externalId/planspace.yaml', async (req: Request, res: Response) => {
  try {
    const { externalId } = req.params
    if (!externalId) {
      return res.status(400).json({ error: 'External ID is required' })
    }

    const flow = await getFlowByExternalId(externalId)
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' })
    }

    res.setHeader('Content-Type', 'text/yaml')
    res.send(flow.plan_yaml || '')
  } catch (err) {
    console.error('Error fetching PlanSpace YAML by external ID:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
