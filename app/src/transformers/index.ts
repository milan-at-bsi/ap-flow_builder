/**
 * Workspace Transformers Registry
 * 
 * Maps workspace names to their domain-specific transformers.
 * Each workspace can have its own transformer that understands
 * the semantics of its blocks and produces appropriate output.
 */

import type { WorkspaceTransformer } from './types'
import { protocolsTransformer } from './protocolsTransformer'
import { actionsTransformer } from './actionsTransformer'

// Re-export types
export type { FlowBlock, TransformerResult, WorkspaceTransformer } from './types'

/**
 * Registry mapping workspace names to their transformers
 */
const transformerRegistry: Record<string, WorkspaceTransformer> = {
  'Protocols': protocolsTransformer,
  'Actions': actionsTransformer,
}

/**
 * Get the transformer for a specific workspace
 * 
 * @param workspaceName - The name of the workspace (e.g., "Protocols", "Actions")
 * @returns The workspace transformer, or undefined if none exists
 */
export function getTransformer(workspaceName: string): WorkspaceTransformer | undefined {
  return transformerRegistry[workspaceName]
}

/**
 * Check if a workspace has a transformer
 * 
 * @param workspaceName - The name of the workspace
 * @returns true if the workspace has a registered transformer
 */
export function hasTransformer(workspaceName: string): boolean {
  return workspaceName in transformerRegistry
}

/**
 * Get the output tab name for a workspace transformer
 * 
 * @param workspaceName - The name of the workspace
 * @returns The output name (e.g., "PlanSpace", "Action Definition"), or undefined
 */
export function getTransformerOutputName(workspaceName: string): string | undefined {
  return transformerRegistry[workspaceName]?.outputName
}

/**
 * Register a new transformer for a workspace
 * (Useful for dynamic workspace loading in the future)
 * 
 * @param workspaceName - The name of the workspace
 * @param transformer - The transformer implementation
 */
export function registerTransformer(workspaceName: string, transformer: WorkspaceTransformer): void {
  transformerRegistry[workspaceName] = transformer
}

// Default export for convenient imports
export default {
  getTransformer,
  hasTransformer,
  getTransformerOutputName,
  registerTransformer,
}
