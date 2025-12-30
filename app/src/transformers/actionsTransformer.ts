/**
 * Actions Workspace Transformer
 * 
 * Transforms Action flow diagrams into PlanSpace format.
 * Domain-specific to: Action, Card, pre_conditions, post_effects, field blocks.
 */

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import type { FlowBlock, TransformerResult, WorkspaceTransformer } from './types'

// PlanSpace YAML structure (output)
interface PlanAction {
  Action: {
    cost: number
    name: string
    pre_conditions: string[]
    post_effects: string[]
  }
}

interface PlanSpaceYaml {
  PlanSpace: {
    Actions: PlanAction[]
    GoalState: {
      expression: string
    }
    StartState: {
      state: Record<string, boolean | string>
    }
  }
}

/**
 * Convert compact YAML format to FlowBlock format
 */
function compactToFlowBlock(blockObj: any): FlowBlock | null {
  if (!blockObj || typeof blockObj !== 'object') return null
  
  const keys = Object.keys(blockObj)
  if (keys.length !== 1) return null
  
  const blockName = keys[0]
  const content = blockObj[blockName]
  
  // Known containers in Actions workspace
  const containerBlocks = ['Action', 'Card', 'State List', 'delivery', 'interaction', 'Policy', 'Pre-Conditions List', 'post_effects']
  const isContainer = containerBlocks.includes(blockName)
  
  const fields: Record<string, string> = {}
  const children: FlowBlock[] = []
  
  // Special handling for 'state' blocks with new format: { variable_name: value }
  // Transform to show the variable name in the block name
  if (blockName === 'state' && Array.isArray(content) && content.length > 0) {
    const firstItem = content[0]
    if (typeof firstItem === 'object' && firstItem !== null) {
      const itemKeys = Object.keys(firstItem)
      if (itemKeys.length === 1) {
        const varName = itemKeys[0]
        const varValue = firstItem[varName]
        // Set the block name to show the state variable: "variable_name: value"
        const displayName = `${varName}: ${varValue}`
        // Also store the variable info in fields
        fields[varName] = String(varValue)
        return {
          type: 'leaf',
          name: displayName,
          fields: fields,
        }
      }
    }
  }
  
  if (content === null || content === undefined) {
    // Empty block
  } else if (typeof content === 'string') {
    fields[blockName] = content
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === 'object' && item !== null) {
        const itemKeys = Object.keys(item)
        if (itemKeys.length === 1) {
          const itemKey = itemKeys[0]
          const itemValue = item[itemKey]
          
          const isNestedContainer = containerBlocks.includes(itemKey)
          const isNestedBlock = typeof itemValue === 'object' || Array.isArray(itemValue) || isNestedContainer
          
          if (isNestedBlock) {
            const childBlock = compactToFlowBlock(item)
            if (childBlock) {
              children.push(childBlock)
            }
          } else if (typeof itemValue === 'string' || typeof itemValue === 'boolean' || typeof itemValue === 'number') {
            fields[itemKey] = String(itemValue)
          }
        }
      }
    }
  } else if (typeof content === 'object') {
    for (const [key, value] of Object.entries(content)) {
      if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
        fields[key] = String(value)
      } else if (Array.isArray(value)) {
        for (const childItem of value) {
          const childBlock = compactToFlowBlock(childItem)
          if (childBlock) {
            children.push(childBlock)
          }
        }
      }
    }
  }
  
  return {
    type: isContainer ? 'container' : 'leaf',
    name: blockName,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    children: children.length > 0 ? children : undefined,
  }
}

/**
 * Actions Workspace Transformer
 * 
 * Converts Action flows to PlanSpace YAML format
 */
export const actionsTransformer: WorkspaceTransformer = {
  outputName: 'PlanSpace',
  
  transform(flowYamlStr: string): TransformerResult {
    try {
      const parsed = parseYaml(flowYamlStr)
      
      if (!parsed || !parsed.diagram) {
        return { yaml: '', error: 'Invalid Flow YAML: missing "diagram" key' }
      }
      
      let diagram: FlowBlock[]
      
      if (Array.isArray(parsed.diagram)) {
        if (parsed.diagram.length > 0 && parsed.diagram[0].type && parsed.diagram[0].name) {
          diagram = parsed.diagram as FlowBlock[]
        } else {
          diagram = parsed.diagram
            .map((block: any) => compactToFlowBlock(block))
            .filter((b: FlowBlock | null): b is FlowBlock => b !== null)
        }
      } else if (typeof parsed.diagram === 'object') {
        const converted = compactToFlowBlock(parsed.diagram)
        diagram = converted ? [converted] : []
      } else {
        return { yaml: '', error: 'Invalid Flow YAML: diagram must be an object or array' }
      }
      
      if (diagram.length === 0) {
        return { yaml: '', error: 'No valid blocks found in diagram' }
      }
      
      const actions: PlanAction[] = []
      // Map of state variable names to their initial values
      const stateVariables: Map<string, boolean | string> = new Map()
      const goalConditions: string[] = []
      
      /**
       * Parse a value string to boolean or string
       */
      function parseStateValue(value: string): boolean | string {
        const lowerValue = value.toLowerCase().trim()
        if (lowerValue === 'true') return true
        if (lowerValue === 'false') return false
        return value
      }
      
      /**
       * Extract state variables from State List block
       */
      function processStateList(block: FlowBlock): void {
        if (!block.children) return
        
        for (const child of block.children) {
          if (child.name === 'state' && child.fields?.init) {
            // Parse init field: "variable_name: value"
            const initValue = child.fields.init
            const colonIndex = initValue.indexOf(':')
            if (colonIndex > 0) {
              const varName = initValue.substring(0, colonIndex).trim()
              const varValue = initValue.substring(colonIndex + 1).trim()
              stateVariables.set(varName, parseStateValue(varValue))
            }
          } else if (child.fields) {
            // New format: fields contain { variable_name: value }
            for (const [key, value] of Object.entries(child.fields)) {
              if (key !== 'init') {
                stateVariables.set(key, parseStateValue(value))
              }
            }
          }
        }
      }
      
      /**
       * Extract action from a Card block
       * Card blocks map to actions named "invoke_card_[card_id]"
       */
      function processCardBlock(block: FlowBlock): void {
        const cardId = block.fields?.card_id || 'unknown_card'
        const actionName = `invoke_card_${cardId}`
        
        let preConditions: string[] = []
        let postEffects: string[] = []
        
        // Traverse children to find Pre-Conditions List, post_effects
        function findChildren(children: FlowBlock[] | undefined): void {
          if (!children) return
          
          for (const child of children) {
            if (child.name === 'State List') {
              // Process state variables
              processStateList(child)
            } else if (child.name === 'Pre-Conditions List') {
              // Look for Pre-Condition leaves
              if (child.children) {
                for (const preCondChild of child.children) {
                  if (preCondChild.name === 'Pre-Condition' && preCondChild.fields?.pre_condition) {
                    preConditions.push(preCondChild.fields.pre_condition)
                  }
                }
              }
            } else if (child.name === 'post_effects') {
              // Look for Post Effect leaves
              if (child.children) {
                for (const postChild of child.children) {
                  if (postChild.name === 'Post Effect' && postChild.fields?.post_effect) {
                    postEffects.push(postChild.fields.post_effect)
                  }
                }
              }
            }
          }
        }
        
        findChildren(block.children)
        
        // Extract state variables from pre_conditions and post_effects
        // Only add if not already in Map (don't override explicit initializations)
        const stateVarRegex = /state\.(\w+)/g
        for (const cond of [...preConditions, ...postEffects]) {
          let match
          while ((match = stateVarRegex.exec(cond)) !== null) {
            const varName = match[1]
            if (!stateVariables.has(varName)) {
              // Default: false for _filled vars, 'unknown' for others
              stateVariables.set(varName, varName.endsWith('_filled') ? false : 'unknown')
            }
          }
        }
        
        // Create the action (always create even if no pre/post - cards are actions)
        actions.push({
          Action: {
            cost: 1,
            name: actionName,
            pre_conditions: preConditions,
            post_effects: postEffects,
          },
        })
      }
      
      /**
       * Process Goal State blocks - extract goal expressions
       */
      function processGoalState(block: FlowBlock): void {
        // Goal State block has a goal_state field with the boolean expression
        const goalExpression = block.fields?.goal_state || ''
        if (goalExpression) {
          // Normalize: ensure "state." prefix if needed
          let normalizedExpr = goalExpression.trim()
          if (!normalizedExpr.startsWith('state.') && !normalizedExpr.startsWith('(')) {
            normalizedExpr = `state.${normalizedExpr}`
          }
          goalConditions.push(normalizedExpr)
          
          // Also extract state variables from the expression for StartState
          // Only add if not already in Map (don't override explicit initializations)
          const stateVarRegex = /state\.(\w+)/g
          let match
          while ((match = stateVarRegex.exec(normalizedExpr)) !== null) {
            const varName = match[1]
            if (!stateVariables.has(varName)) {
              stateVariables.set(varName, varName.endsWith('_filled') ? false : 'unknown')
            }
          }
        }
      }
      
      /**
       * Traverse the block tree to find Card and Goal State blocks
       */
      function traverse(blocks: FlowBlock[]): void {
        for (const block of blocks) {
          if (block.name === 'Card') {
            processCardBlock(block)
          } else if (block.name === 'Goal State') {
            processGoalState(block)
          } else if (block.name === 'State List') {
            processStateList(block)
          } else if (block.type === 'container' && block.children) {
            traverse(block.children)
          }
        }
      }
      
      traverse(diagram)
      
      // Build StartState from the Map - use the actual initial values stored
      const startState: Record<string, boolean | string> = {}
      for (const [varName, initialValue] of stateVariables.entries()) {
        startState[varName] = initialValue
      }
      
      // Build GoalState expression
      // Multiple Goal States are combined with OR logic (flow ends when ANY goal is satisfied)
      let goalExpression = '(all actions completed)'
      if (goalConditions.length === 1) {
        goalExpression = goalConditions[0]
      } else if (goalConditions.length > 1) {
        // Wrap each expression in parentheses and join with " or "
        goalExpression = goalConditions
          .map(expr => expr.startsWith('(') ? expr : `(${expr})`)
          .join(' or ')
      }
      
      // Build PlanSpace output
      const planSpace: PlanSpaceYaml = {
        PlanSpace: {
          Actions: actions,
          GoalState: {
            expression: goalExpression,
          },
          StartState: {
            state: startState,
          },
        },
      }
      
      return { yaml: stringifyYaml(planSpace, { indent: 2 }) }
      
    } catch (err) {
      return { yaml: '', error: `Actions transformation error: ${err}` }
    }
  },
  
  transformBlocks(blocks: FlowBlock[]): TransformerResult {
    // Convert blocks array to YAML string and use main transform
    const flowYaml = stringifyYaml({ diagram: blocks }, { indent: 2 })
    return this.transform(flowYaml)
  }
}
