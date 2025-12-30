import fs from 'fs'
import path from 'path'

// Path to the app's public/ai_context directory
// In Docker, this will be mounted or we'll need to configure the path
const AI_CONTEXT_BASE = process.env.AI_CONTEXT_PATH || path.join(__dirname, '../../../app/public/ai_context')

export interface ContextFile {
  name: string
  content: string
}

/**
 * Load the workspace-level context file
 */
export async function loadWorkspaceContext(workspace: string): Promise<string> {
  const fileName = `_workspace_${workspace}.yaml`
  const filePath = path.join(AI_CONTEXT_BASE, fileName)
  
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error(`Failed to load workspace context: ${filePath}`, error)
    return ''
  }
}

/**
 * Load all block context files for a workspace
 */
export async function loadBlockContextFiles(workspace: string): Promise<ContextFile[]> {
  const dirPath = path.join(AI_CONTEXT_BASE, workspace)
  const files: ContextFile[] = []
  
  try {
    const fileNames = fs.readdirSync(dirPath)
    
    for (const fileName of fileNames) {
      if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) continue
      // Skip files starting with underscore (meta files)
      if (fileName.startsWith('_')) continue
      
      const filePath = path.join(dirPath, fileName)
      const content = fs.readFileSync(filePath, 'utf-8')
      files.push({ name: fileName, content })
    }
  } catch (error) {
    console.error(`Failed to load block context files from: ${dirPath}`, error)
  }
  
  return files
}

/**
 * Build the complete system prompt for the AI
 */
export async function buildSystemPrompt(
  workspace: string,
  currentFlowYaml?: string
): Promise<string> {
  const workspaceContext = await loadWorkspaceContext(workspace)
  const blockFiles = await loadBlockContextFiles(workspace)
  
  // Build block definitions section
  const blockDefinitions = blockFiles
    .map(f => `### ${f.name}\n\`\`\`yaml\n${f.content}\n\`\`\``)
    .join('\n\n')
  
  const systemPrompt = `You are a flow builder assistant for the "${workspace}" workspace.

## Your Role
Help users create visual flows by generating valid YAML definitions. You are assisting with a visual flow builder where blocks are arranged in a tree structure.

## IMPORTANT: Output Format
When generating YAML flows, you MUST use this exact format that the visual builder can import:

\`\`\`yaml
diagram:
  - type: container
    name: BlockName
    fields:
      field_name: value
    children:
      - type: container
        name: ChildBlock
        fields:
          field_name: value
        children:
          - type: leaf
            name: LeafBlock
            fields:
              field_name: value
\`\`\`

Key rules:
- Root element is always "diagram:"
- Each block has: type (container/leaf), name, fields, and children (for containers)
- "type" must be "container" or "leaf"
- "name" is the block name from the workspace
- "fields" is an object with field names and values
- "children" is an array of child blocks (only for containers)

## Workspace Context
${workspaceContext || 'No workspace context available.'}

## Available Blocks
These are the blocks available in this workspace. Each block definition includes its intent, fields, allowed parents/children, and examples.

${blockDefinitions || 'No block definitions available.'}

## Current User Flow
${currentFlowYaml ? `The user's current canvas has this flow:\n\`\`\`yaml\n${currentFlowYaml}\n\`\`\`` : 'The canvas is currently empty.'}

## Instructions
1. When the user describes what they want, generate the appropriate YAML using the exact format above
2. Explain briefly what you're creating and why
3. If building incrementally, show how the new parts fit into the existing flow
4. Always use the correct block structure based on the block definitions
5. Make sure parent-child relationships are valid (check allowed_parents/allowed_children)
6. Include all required fields for each block
7. Be conversational and helpful - ask clarifying questions if needed

Remember: Your YAML output will be visually rendered as blocks, so focus on getting the structure correct.`

  return systemPrompt
}

/**
 * Extract YAML code blocks from AI response
 */
export function extractYamlFromResponse(response: string): string | null {
  // Look for ```yaml ... ``` blocks
  const yamlMatch = response.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)```/i)
  if (yamlMatch) {
    return yamlMatch[1].trim()
  }
  return null
}

/**
 * Validate that YAML has the required diagram format
 */
export function validateDiagramFormat(yaml: string): { valid: boolean; error?: string } {
  if (!yaml.trim().startsWith('diagram:')) {
    return { valid: false, error: 'YAML must start with "diagram:"' }
  }
  return { valid: true }
}
