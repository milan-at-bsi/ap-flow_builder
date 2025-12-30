/**
 * Protocols Workspace Transformer
 * 
 * Transforms Protocol flow diagrams into PlanSpace YAML format.
 * Domain-specific to: Protocol, Switch, Case, Fill Data, Access Decision blocks.
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

// Context for tracking state during traversal
interface TraversalContext {
  completedActions: string[]
  branchConditions: string[]
  switchOnField?: string
}

// Known block types for this workspace
const CONTAINER_BLOCKS = ['Protocol', 'Switch', 'Case', 'Fill Data']
const LEAF_BLOCKS = ['Access Decision', 'Instruct Driver', 'required']

/**
 * Convert compact YAML format to FlowBlock format
 */
function compactToFlowBlock(blockObj: any): FlowBlock | null {
  if (!blockObj || typeof blockObj !== 'object') return null
  
  const keys = Object.keys(blockObj)
  if (keys.length !== 1) return null
  
  const blockName = keys[0]
  const content = blockObj[blockName]
  
  // Handle special data_field format
  if (blockName === 'data_field' && typeof content === 'string') {
    return {
      type: 'leaf',
      name: content,
      block_type: 'data_field',
    }
  }
  
  const isContainerBlock = CONTAINER_BLOCKS.includes(blockName)
  const blockType: 'container' | 'leaf' = isContainerBlock ? 'container' : 'leaf'
  
  const fields: Record<string, string> = {}
  const children: FlowBlock[] = []
  let extractedBlockType: string | undefined = undefined
  
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
          
          if (itemKey === 'block_type' && typeof itemValue === 'string') {
            extractedBlockType = itemValue
            continue
          }
          
          if (itemKey === 'data_field' && typeof itemValue === 'string') {
            const childBlock = compactToFlowBlock(item)
            if (childBlock) children.push(childBlock)
            continue
          }
          
          const isNestedBlock = typeof itemValue === 'object' || Array.isArray(itemValue)
          const looksLikeBlockName = CONTAINER_BLOCKS.includes(itemKey) || 
                                     LEAF_BLOCKS.includes(itemKey) ||
                                     (typeof itemValue === 'object' && itemValue?.block_type)
          
          if (isNestedBlock || looksLikeBlockName) {
            const childBlock = compactToFlowBlock(item)
            if (childBlock) children.push(childBlock)
          } else if (typeof itemValue === 'string') {
            fields[itemKey] = itemValue
          }
        }
      }
    }
  } else if (typeof content === 'object') {
    for (const [key, value] of Object.entries(content)) {
      if (key === 'block_type' && typeof value === 'string') {
        extractedBlockType = value
      } else if (typeof value === 'string') {
        fields[key] = value
      } else if (Array.isArray(value)) {
        for (const childItem of value) {
          const childBlock = compactToFlowBlock(childItem)
          if (childBlock) children.push(childBlock)
        }
      }
    }
  }
  
  return {
    type: blockType,
    name: blockName,
    block_type: extractedBlockType,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    children: children.length > 0 ? children : undefined,
  }
}

/**
 * Core transformation logic
 */
function transformToPlanSpace(diagram: FlowBlock[]): TransformerResult {
  const actions: PlanAction[] = []
  const stateVariables: Set<string> = new Set()
  
  function traverse(blocks: FlowBlock[], context: TraversalContext): void {
    for (const block of blocks) {
      if (block.type === 'leaf') {
        handleLeafNode(block, context)
      } else if (block.type === 'container') {
        handleContainerNode(block, context)
      }
    }
  }

  function handleLeafNode(block: FlowBlock, context: TraversalContext): void {
    const nodeName = block.name
    const fields = block.fields || {}

    if (nodeName === 'Fill Data' || nodeName.startsWith('Fill Data')) {
      const fieldName = fields.name || fields.field_name || 'unknown'
      const actionName = `fill_${fieldName}`
      const stateVar = `${fieldName}_filled`

      stateVariables.add(stateVar)

      const preConditions: string[] = []
      
      for (const branchCond of context.branchConditions) {
        preConditions.push(`state.${branchCond}`)
      }
      
      for (const completedAction of context.completedActions) {
        preConditions.push(`state.${completedAction} == True`)
      }
      
      preConditions.push(`state.${stateVar} == False`)

      actions.push({
        Action: {
          cost: 1,
          name: actionName,
          pre_conditions: preConditions,
          post_effects: [`state.${stateVar} = True`],
        },
      })

      context.completedActions = [...context.completedActions, stateVar]

    } else if (nodeName === 'Access Decision') {
      const accessValue = (fields.access || '').toLowerCase()

      stateVariables.add('access_granted')
      stateVariables.add('access_denied')

      const preConditions: string[] = []
      
      for (const branchCond of context.branchConditions) {
        preConditions.push(`state.${branchCond}`)
      }
      
      for (const completedAction of context.completedActions) {
        preConditions.push(`state.${completedAction} == True`)
      }

      if (accessValue === 'granted') {
        actions.push({
          Action: {
            cost: 1,
            name: 'grant_access',
            pre_conditions: preConditions,
            post_effects: ['state.access_granted = True', 'state.access_denied = False'],
          },
        })
      } else if (accessValue === 'denied') {
        actions.push({
          Action: {
            cost: 1,
            name: 'deny_access',
            pre_conditions: preConditions,
            post_effects: ['state.access_granted = False', 'state.access_denied = True'],
          },
        })
      }
    } else if (nodeName === 'Instruct Driver' || nodeName.includes('Instruct') || nodeName.includes('Prompt')) {
      const fieldName = fields.name || nodeName.toLowerCase().replace(/\s+/g, '_')
      const actionName = fieldName.includes('_') ? fieldName : nodeName.toLowerCase().replace(/\s+/g, '_')
      const stateVar = `${actionName}_filled`

      stateVariables.add(stateVar)

      const preConditions: string[] = []
      
      for (const branchCond of context.branchConditions) {
        preConditions.push(`state.${branchCond}`)
      }
      
      for (const completedAction of context.completedActions) {
        preConditions.push(`state.${completedAction} == True`)
      }
      
      preConditions.push(`state.${stateVar} == False`)

      actions.push({
        Action: {
          cost: 1,
          name: actionName,
          pre_conditions: preConditions,
          post_effects: [`state.${stateVar} = True`],
        },
      })

      context.completedActions = [...context.completedActions, stateVar]
    }
  }

  function handleContainerNode(block: FlowBlock, context: TraversalContext): void {
    const nodeName = block.name
    const fields = block.fields || {}
    const children = block.children || []
    const blockTypeAttr = block.block_type

    if (nodeName === 'Switch') {
      const switchOnField = fields.On || fields.on || ''
      
      const newContext: TraversalContext = {
        ...context,
        switchOnField: switchOnField || context.switchOnField,
      }
      
      traverse(children, newContext)
      
    } else if (nodeName === 'Case') {
      const caseValue = fields.match || ''
      let branchCondition = ''
      
      if (caseValue) {
        if (context.switchOnField) {
          branchCondition = `${context.switchOnField} == "${caseValue}"`
        } else {
          const recentFilled = context.completedActions.filter(a => a.endsWith('_filled'))
          
          if (recentFilled.length > 0) {
            const lastFilled = recentFilled[recentFilled.length - 1]
            const varName = lastFilled.replace('_filled', '')
            branchCondition = `${varName} == "${caseValue}"`
          }
        }
      }

      const newContext: TraversalContext = {
        completedActions: [...context.completedActions],
        branchConditions: branchCondition 
          ? [...context.branchConditions, branchCondition]
          : context.branchConditions,
        switchOnField: context.switchOnField,
      }

      traverse(children, newContext)
      
    } else if (nodeName === 'Protocol') {
      traverse(children, { ...context })
      
    } else if (nodeName === 'Fill Data' && blockTypeAttr === 'Action') {
      const dataFieldChildren = children.filter(c => c.block_type === 'data_field')
      
      if (dataFieldChildren.length > 0) {
        const fieldName = dataFieldChildren[0].name
        const actionName = `fill_${fieldName}`
        const stateVar = `${fieldName}_filled`

        stateVariables.add(stateVar)

        const preConditions: string[] = []
        
        for (const branchCond of context.branchConditions) {
          preConditions.push(`state.${branchCond}`)
        }
        
        for (const completedAction of context.completedActions) {
          preConditions.push(`state.${completedAction} == True`)
        }
        
        preConditions.push(`state.${stateVar} == False`)

        actions.push({
          Action: {
            cost: 1,
            name: actionName,
            pre_conditions: preConditions,
            post_effects: [`state.${stateVar} = True`],
          },
        })

        context.completedActions = [...context.completedActions, stateVar]
      }
      
    } else {
      traverse(children, { ...context })
    }
  }

  const initialContext: TraversalContext = {
    completedActions: [],
    branchConditions: [],
  }

  traverse(diagram, initialContext)

  // Build StartState
  const startState: Record<string, boolean | string> = {}
  
  for (const stateVar of stateVariables) {
    if (stateVar === 'access_granted' || stateVar === 'access_denied') {
      startState[stateVar] = false
    } else if (stateVar.endsWith('_filled')) {
      startState[stateVar] = false
    } else {
      startState[stateVar] = 'unknown'
    }
  }

  // Add referenced variables from branch conditions
  for (const action of actions) {
    for (const preCond of action.Action.pre_conditions) {
      const match = preCond.match(/state\.(\w+)\s*==/)
      if (match && match[1] && !Object.prototype.hasOwnProperty.call(startState, match[1])) {
        const varName = match[1]
        if (!varName.endsWith('_filled') && varName !== 'access_granted' && varName !== 'access_denied') {
          startState[varName] = 'unknown'
        }
      }
    }
  }

  // Build PlanSpace YAML structure
  const planSpace: PlanSpaceYaml = {
    PlanSpace: {
      Actions: actions,
      GoalState: {
        expression: '(state.access_granted == True) or (state.access_denied == True)',
      },
      StartState: {
        state: startState,
      },
    },
  }

  const yamlOutput = stringifyYaml(planSpace, { indent: 2 })
  return { yaml: yamlOutput }
}

/**
 * Protocols Workspace Transformer
 * Converts Protocol flows to PlanSpace YAML
 */
export const protocolsTransformer: WorkspaceTransformer = {
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

      return transformToPlanSpace(diagram)

    } catch (err) {
      return { yaml: '', error: `PlanSpace transformation error: ${err}` }
    }
  },
  
  transformBlocks(blocks: FlowBlock[]): TransformerResult {
    try {
      return transformToPlanSpace(blocks)
    } catch (err) {
      return { yaml: '', error: `PlanSpace transformation error: ${err}` }
    }
  }
}
