import React, { useState, useRef, useEffect, useCallback } from 'react'
import { BlockPreview } from './BlockPreview'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  yaml?: string | null
  isStreaming?: boolean
}

interface AIChatTabProps {
  workspace: string
  currentFlowYaml: string
  onApplyYaml: (yaml: string) => void
}

const API_BASE = 'http://localhost:3001'

/**
 * AI Chat Assistant Tab component
 */
export function AIChatTab({ workspace, currentFlowYaml, onApplyYaml }: AIChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; error?: string } | null>(null)
  const [showYaml, setShowYaml] = useState<string | null>(null) // ID of message to show YAML for
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check AI status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/ai/status`)
      .then(res => res.json())
      .then(data => setAiStatus({ configured: data.configured }))
      .catch(err => setAiStatus({ configured: false, error: err.message }))
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: trimmedInput }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Add placeholder for assistant response
    const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '', isStreaming: true }
    setMessages(prev => [...prev, assistantPlaceholder])

    try {
      // Build history from previous messages (excluding the streaming placeholder)
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const response = await fetch(`${API_BASE}/api/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace,
          message: trimmedInput,
          history,
          currentFlowYaml: currentFlowYaml || undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get AI response')
      }

      // Handle SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let extractedYaml: string | null = null

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'chunk') {
                fullContent += data.content
                // Update the streaming message
                setMessages(prev => {
                  const updated = [...prev]
                  const lastIdx = updated.length - 1
                  if (updated[lastIdx]?.isStreaming) {
                    updated[lastIdx] = { ...updated[lastIdx], content: fullContent }
                  }
                  return updated
                })
              } else if (data.type === 'done') {
                fullContent = data.content
                extractedYaml = data.yaml
              } else if (data.type === 'error') {
                throw new Error(data.error)
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // Finalize the message
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (updated[lastIdx]?.isStreaming) {
          updated[lastIdx] = {
            role: 'assistant',
            content: fullContent,
            yaml: extractedYaml,
            isStreaming: false
          }
        }
        return updated
      })
    } catch (error: any) {
      // Update placeholder with error
      setMessages(prev => {
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (updated[lastIdx]?.isStreaming) {
          updated[lastIdx] = {
            role: 'assistant',
            content: `Error: ${error.message}`,
            isStreaming: false
          }
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, workspace, currentFlowYaml])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  // Extract YAML from markdown code blocks in content
  const extractYamlFromContent = (content: string): string | null => {
    const match = content.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)```/i)
    return match ? match[1].trim() : null
  }

  // Remove YAML blocks from content for display
  const removeYamlBlocks = (content: string): string => {
    return content.replace(/```(?:yaml|yml)?\s*\n[\s\S]*?```/gi, '[Flow diagram shown below]').trim()
  }

  // Remove YAML blocks during streaming - show "Working in the background..."
  const removeYamlBlocksStreaming = (content: string): string => {
    // Check if we're in the middle of a YAML block (started but not closed)
    const yamlStartMatch = content.match(/```(?:yaml|yml)?\s*\n/i)
    const yamlEndMatch = content.match(/```(?:yaml|yml)?\s*\n[\s\S]*?```/i)
    
    // If YAML block started but not finished, replace from start to end with "Working..."
    if (yamlStartMatch && !yamlEndMatch) {
      const beforeYaml = content.slice(0, yamlStartMatch.index).trim()
      return beforeYaml + (beforeYaml ? '\n\n' : '') + '⏳ Working in the background...'
    }
    
    // If complete YAML blocks exist, replace them
    return content.replace(/```(?:yaml|yml)?\s*\n[\s\S]*?```/gi, '⏳ Working in the background...').trim()
  }

  const renderMessage = (msg: ChatMessage, index: number) => {
    const isUser = msg.role === 'user'
    const yaml = msg.yaml || extractYamlFromContent(msg.content)
    // Use streaming-friendly display during streaming, regular display when done
    const displayContent = msg.isStreaming 
      ? removeYamlBlocksStreaming(msg.content)
      : (yaml ? removeYamlBlocks(msg.content) : msg.content)
    const messageId = `msg-${index}`

    return (
      <div
        key={index}
        style={{
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Role label */}
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          marginBottom: 4,
          fontWeight: 600,
        }}>
          {isUser ? 'You' : '🤖 AI Assistant'}
        </span>

        {/* Message content */}
        <div
          style={{
            maxWidth: '90%',
            padding: '10px 14px',
            borderRadius: 12,
            background: isUser ? '#4f46e5' : 'var(--bg-tertiary)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {displayContent || (msg.isStreaming ? '...' : '')}
          {msg.isStreaming && (
            <span className="streaming-cursor" style={{
              display: 'inline-block',
              width: 8,
              height: 14,
              background: 'var(--text-primary)',
              marginLeft: 2,
              animation: 'blink 1s infinite',
            }} />
          )}
        </div>

        {/* YAML Preview */}
        {yaml && !msg.isStreaming && (
          <div style={{ marginTop: 8, width: '90%' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => setShowYaml(showYaml === messageId ? null : messageId)}
                style={{
                  padding: '4px 10px',
                  background: 'var(--btn-neutral)',
                  border: 'none',
                  borderRadius: 4,
                  color: 'var(--text-secondary)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                {showYaml === messageId ? 'Hide YAML' : 'View YAML'}
              </button>
            </div>
            
            {showYaml === messageId && (
              <pre style={{
                padding: 10,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                fontSize: 10,
                overflow: 'auto',
                maxHeight: 200,
                marginBottom: 8,
              }}>
                {yaml}
              </pre>
            )}
            
            <BlockPreview
              yaml={yaml}
              onApply={() => onApplyYaml(yaml)}
              showApplyButton={true}
            />
          </div>
        )}
      </div>
    )
  }

  if (!aiStatus) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Checking AI status...
      </div>
    )
  }

  if (!aiStatus.configured) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>
          AI Assistant Not Configured
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
          Set the <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 3 }}>ANTHROPIC_API_KEY</code> environment variable in the API server to enable AI assistance.
        </div>
        {aiStatus.error && (
          <div style={{ color: '#f87171', fontSize: 11, marginTop: 8 }}>
            Error: {aiStatus.error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(16, 185, 129, 0.1)',
      }}>
        <span style={{ color: '#34d399', fontSize: 11, fontWeight: 500 }}>
          🤖 Workspace: {workspace}
        </span>
        <button
          onClick={clearChat}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 12,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            padding: 20,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              AI Flow Assistant
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              Describe what flow you want to create in plain English.
              <br />
              I'll generate the block structure for you.
            </div>
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'var(--bg-tertiary)',
              borderRadius: 8,
              fontSize: 11,
              textAlign: 'left',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                Example prompts:
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                • "Create an action to collect truck number with a 30 second timeout"
                <br />
                • "I need to collect both truck and trailer numbers"
                <br />
                • "Add a pre-condition to check if the field isn't already filled"
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => renderMessage(msg, i))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 12,
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what flow you want to create..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 8,
              color: 'var(--input-text)',
              fontSize: 13,
              resize: 'none',
              outline: 'none',
              minHeight: 130,
              maxHeight: 200,
              fontFamily: 'inherit',
            }}
            rows={4}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            style={{
              padding: '10px 16px',
              background: isLoading || !input.trim() ? 'var(--btn-neutral)' : '#10b981',
              border: 'none',
              borderRadius: 8,
              color: isLoading || !input.trim() ? 'var(--text-secondary)' : '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        <div style={{
          marginTop: 6,
          fontSize: 10,
          color: 'var(--text-muted)',
        }}>
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
