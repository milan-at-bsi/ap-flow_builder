/**
 * Common types for all workspace transformers
 */

// Flow YAML structure (input from serialization)
export interface FlowBlock {
  type: 'container' | 'leaf'
  name: string
  block_type?: string  // e.g., 'Action', 'data_field', 'constraint'
  fields?: Record<string, string>
  children?: FlowBlock[]
}

// Transformer result
export interface TransformerResult {
  yaml: string
  error?: string
}

// Transformer interface - all workspace transformers must implement this
export interface WorkspaceTransformer {
  /** Name of the output format (shown in tabs) */
  outputName: string
  
  /** Transform flow YAML string to workspace-specific output */
  transform(flowYamlStr: string): TransformerResult
  
  /** Transform flow blocks directly to workspace-specific output */
  transformBlocks(blocks: FlowBlock[]): TransformerResult
}
