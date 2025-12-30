import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, extractYamlFromResponse } from '../services/contextBuilder'

const router = Router()

// Initialize Anthropic client - will use ANTHROPIC_API_KEY from environment
const getAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }
  return new Anthropic({ apiKey })
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  workspace: string
  message: string
  history?: ChatMessage[]
  currentFlowYaml?: string
}

/**
 * POST /api/ai/chat/stream
 * Streaming chat endpoint using Server-Sent Events
 */
router.post('/chat/stream', async (req: Request, res: Response) => {
  const { workspace, message, history = [], currentFlowYaml } = req.body as ChatRequest

  if (!workspace || !message) {
    res.status(400).json({ error: 'workspace and message are required' })
    return
  }

  // Validate workspace
  const validWorkspaces = ['actions', 'protocols']
  if (!validWorkspaces.includes(workspace)) {
    res.status(400).json({ error: `Invalid workspace. Must be one of: ${validWorkspaces.join(', ')}` })
    return
  }

  try {
    const anthropic = getAnthropicClient()
    
    // Build system prompt with workspace context
    const systemPrompt = await buildSystemPrompt(workspace, currentFlowYaml)

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Convert history to Anthropic format
    const messages: Anthropic.MessageParam[] = [
      ...history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user' as const, content: message }
    ]

    // Stream response from Claude
    let fullResponse = ''
    
    const stream = await anthropic.messages.stream({
      // model: 'claude-sonnet-4-20250514',  // Previous model
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      system: systemPrompt,
      messages
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string }
        if (delta.type === 'text_delta' && delta.text) {
          fullResponse += delta.text
          
          // Send chunk to client
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta.text })}\n\n`)
        }
      }
    }

    // Extract YAML from response if present
    const extractedYaml = extractYamlFromResponse(fullResponse)
    
    // Send completion event with full response and extracted YAML
    res.write(`data: ${JSON.stringify({ 
      type: 'done', 
      content: fullResponse,
      yaml: extractedYaml 
    })}\n\n`)
    
    res.end()
  } catch (error: any) {
    console.error('AI chat error:', error)
    
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to process AI request' })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
      res.end()
    }
  }
})

/**
 * POST /api/ai/chat
 * Non-streaming chat endpoint (simpler, for testing)
 */
router.post('/chat', async (req: Request, res: Response) => {
  const { workspace, message, history = [], currentFlowYaml } = req.body as ChatRequest

  if (!workspace || !message) {
    res.status(400).json({ error: 'workspace and message are required' })
    return
  }

  const validWorkspaces = ['actions', 'protocols']
  if (!validWorkspaces.includes(workspace)) {
    res.status(400).json({ error: `Invalid workspace. Must be one of: ${validWorkspaces.join(', ')}` })
    return
  }

  try {
    const anthropic = getAnthropicClient()
    const systemPrompt = await buildSystemPrompt(workspace, currentFlowYaml)

    const messages: Anthropic.MessageParam[] = [
      ...history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user' as const, content: message }
    ]

    const response = await anthropic.messages.create({
      // model: 'claude-sonnet-4-20250514',  // Previous model
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      system: systemPrompt,
      messages
    })

    const textContent = response.content.find((c: { type: string }) => c.type === 'text')
    const responseText = textContent?.type === 'text' ? textContent.text : ''
    const extractedYaml = extractYamlFromResponse(responseText)

    res.json({
      content: responseText,
      yaml: extractedYaml
    })
  } catch (error: any) {
    console.error('AI chat error:', error)
    res.status(500).json({ error: error.message || 'Failed to process AI request' })
  }
})

/**
 * GET /api/ai/status
 * Check if AI is configured and ready
 */
router.get('/status', (req: Request, res: Response) => {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY
  res.json({
    configured: hasApiKey,
    provider: 'anthropic',
    // model: 'claude-sonnet-4-20250514'  // Previous model
    model: 'claude-opus-4-5-20251101'
  })
})

export default router
