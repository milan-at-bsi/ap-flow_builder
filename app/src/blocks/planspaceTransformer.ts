import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'

// Flow YAML structure (input)
interface FlowBlock {
  type: 'container' | 'leaf'
  name: string
  block_type?: string  // e.g., 'Action', 'data_field', 'constraint'
  fields?: Record<string, string>
  children?: FlowBlock[]
}

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
  // Pre-conditions from completed actions in the current path
  completedActions: string[]
  // Branch conditions from Case nodes (e.g., "vehicle_type == \"bobtail\"")
  branchConditions: string[]
  // The "On" field value from parent Switch (e.g., "vehicle_type")
  switchOnField?: string
}

/**
 * Known container block names
 */
const CONTAINER_BLOCKS = ['Protocol', 'Switch', 'Case', 'Fill Data']

/**
 * Known leaf block names and patterns
 */
const LEAF_BLOCKS = ['Access Decision', 'Instruct Driver', 'required']

/**
 * Convert compact YAML format to legacy FlowBlock format
 * Now supports block_type attribute for categorization
 */
function compactToFlowBlock(blockObj: any, _blockDefs?: any[]): FlowBlock | null {
  if (!blockObj || typeof blockObj !== 'object') return null
  
  const keys = Object.keys(blockObj)
  if (keys.length !== 1) return null
  
  const blockName = keys[0]
  const content = blockObj[blockName]
  
  // Handle special data_field format: { data_field: "vehicle_type" }
  if (blockName === 'data_field' && typeof content === 'string') {
    return {
      type: 'leaf',
      name: content,
      block_type: 'data_field',
    }
  }
  
  // Determine block type by checking container list first
  const isContainerBlock = CONTAINER_BLOCKS.includes(blockName)
  
  // Default: if not a known container, treat as leaf (e.g., data_field items)
  const blockType: 'container' | 'leaf' = isContainerBlock ? 'container' : 'leaf'
  
  const fields: Record<string, string> = {}
  const children: FlowBlock[] = []
  let extractedBlockType: string | undefined = undefined
  
  if (content === null || content === undefined) {
    // No content - this is a simple block with just a name (e.g., vehicle_type leaf)
  } else if (typeof content === 'string') {
    // Direct value format: { intent: "collect" }
    fields[blockName] = content
  } else if (Array.isArray(content)) {
    // Array of children and/or fields
    for (const item of content) {
      if (typeof item === 'object' && item !== null) {
        const itemKeys = Object.keys(item)
        if (itemKeys.length === 1) {
          const itemKey = itemKeys[0]
          const itemValue = item[itemKey]
          
          // Check for block_type field
          if (itemKey === 'block_type' && typeof itemValue === 'string') {
            extractedBlockType = itemValue
            continue
          }
          
          // Special handling for data_field format: { data_field: "vehicle_type" }
          if (itemKey === 'data_field' && typeof itemValue === 'string') {
            const childBlock = compactToFlowBlock(item)
            if (childBlock) {
              children.push(childBlock)
            }
            continue
          }
          
          // Check if this is a nested block or a field
          const isNestedBlock = typeof itemValue === 'object' || Array.isArray(itemValue)
          const looksLikeBlockName = CONTAINER_BLOCKS.includes(itemKey) || 
                                     LEAF_BLOCKS.includes(itemKey) ||
                                     // Also treat any item with block_type as a block
                                     (typeof itemValue === 'object' && itemValue?.block_type)
          
          if (isNestedBlock || looksLikeBlockName) {
            // It's a child block
            const childBlock = compactToFlowBlock(item)
            if (childBlock) {
              children.push(childBlock)
            }
          } else if (typeof itemValue === 'string') {
            // It's a field
            fields[itemKey] = itemValue
          }
        }
      }
    }
  } else if (typeof content === 'object') {
    // Object with fields
    for (const [key, value] of Object.entries(content)) {
      if (key === 'block_type' && typeof value === 'string') {
        extractedBlockType = value
      } else if (typeof value === 'string') {
        fields[key] = value
      } else if (Array.isArray(value)) {
        // Children array
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
    type: blockType,
    name: blockName,
    block_type: extractedBlockType,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    children: children.length > 0 ? children : undefined,
  }
}

/**
 * Transform Flow YAML to PlanSpace YAML
 */
export function flowToPlanSpace(flowYamlStr: string): { yaml: string; error?: string } {
  try {
    // Parse flow YAML
    const parsed = parseYaml(flowYamlStr)

    if (!parsed || !parsed.diagram) {
      return { yaml: '', error: 'Invalid Flow YAML: missing "diagram" key' }
    }
    
    let diagram: FlowBlock[]
    
    // Handle both legacy array format and compact object format
    if (Array.isArray(parsed.diagram)) {
      // Check if it's legacy format [{type, name, ...}] or compact format [{BlockName: ...}]
      if (parsed.diagram.length > 0 && parsed.diagram[0].type && parsed.diagram[0].name) {
        // Legacy format
        diagram = parsed.diagram as FlowBlock[]
      } else {
        // Compact format array
        diagram = parsed.diagram
          .map((block: any) => compactToFlowBlock(block))
          .filter((b: FlowBlock | null): b is FlowBlock => b !== null)
      }
    } else if (typeof parsed.diagram === 'object') {
      // Single compact block (most common case)
      const converted = compactToFlowBlock(parsed.diagram)
      diagram = converted ? [converted] : []
    } else {
      return { yaml: '', error: 'Invalid Flow YAML: diagram must be an object or array' }
    }
    
    if (diagram.length === 0) {
      return { yaml: '', error: 'No valid blocks found in diagram' }
    }

    const actions: PlanAction[] = []
    const stateVariables: Set<string> = new Set()
    
    // Track which state variables have been filled by field name
    // This helps build pre-conditions for sequential actions
    
    /**
     * Recursively traverse the flow tree and generate actions
     */
    function traverse(blocks: FlowBlock[], context: TraversalContext): void {
      for (const block of blocks) {
        if (block.type === 'leaf') {
          handleLeafNode(block, context)
        } else if (block.type === 'container') {
          handleContainerNode(block, context)
        }
      }
    }

    /**
     * Handle leaf nodes - generate actions based on node name
     */
    function handleLeafNode(block: FlowBlock, context: TraversalContext): void {
      const nodeName = block.name
      const fields = block.fields || {}

      // Handle "Fill Data" or "Fill Data (XXX)" variations
      if (nodeName === 'Fill Data' || nodeName.startsWith('Fill Data')) {
        // Extract field name and generate fill_[name] action
        const fieldName = fields.name || fields.field_name || 'unknown'
        const actionName = `fill_${fieldName}`
        const stateVar = `${fieldName}_filled`

        stateVariables.add(stateVar)

        // Build pre-conditions: all previous filled states + branch conditions + this not filled
        const preConditions: string[] = []
        
        // Add branch conditions first
        for (const branchCond of context.branchConditions) {
          preConditions.push(`state.${branchCond}`)
        }
        
        // Add completed action pre-conditions
        for (const completedAction of context.completedActions) {
          preConditions.push(`state.${completedAction} == True`)
        }
        
        // This action's own pre-condition (not yet filled)
        preConditions.push(`state.${stateVar} == False`)

        // Post-effects
        const postEffects = [`state.${stateVar} = True`]

        actions.push({
          Action: {
            cost: 1,
            name: actionName,
            pre_conditions: preConditions,
            post_effects: postEffects,
          },
        })

        // Add to completed actions for subsequent nodes
        context.completedActions = [...context.completedActions, stateVar]

      } else if (nodeName === 'Access Decision') {
        // Check access field value
        const accessValue = (fields.access || '').toLowerCase()

        if (accessValue === 'granted') {
          generateAccessAction('grant_access', true, context)
        } else if (accessValue === 'denied') {
          generateAccessAction('deny_access', false, context)
        }
      } else if (nodeName === 'Instruct Driver' || nodeName.includes('Instruct') || nodeName.includes('Prompt')) {
        // Handle instruction/prompt nodes similar to Fill Data
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

        const postEffects = [`state.${stateVar} = True`]

        actions.push({
          Action: {
            cost: 1,
            name: actionName,
            pre_conditions: preConditions,
            post_effects: postEffects,
          },
        })

        context.completedActions = [...context.completedActions, stateVar]
      }
    }

    /**
     * Generate grant_access or deny_access action
     */
    function generateAccessAction(
      actionName: string,
      isGrant: boolean,
      context: TraversalContext
    ): void {
      stateVariables.add('access_granted')
      stateVariables.add('access_denied')

      const preConditions: string[] = []
      
      // Add branch conditions
      for (const branchCond of context.branchConditions) {
        preConditions.push(`state.${branchCond}`)
      }
      
      // Add completed action pre-conditions
      for (const completedAction of context.completedActions) {
        preConditions.push(`state.${completedAction} == True`)
      }

      const postEffects = isGrant
        ? ['state.access_granted = True', 'state.access_denied = False']
        : ['state.access_granted = False', 'state.access_denied = True']

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
     * Handle container nodes - traverse children with updated context
     */
    function handleContainerNode(block: FlowBlock, context: TraversalContext): void {
      const nodeName = block.name
      const fields = block.fields || {}
      const children = block.children || []
      const blockTypeAttr = block.block_type

      if (nodeName === 'Switch') {
        // Extract the "On" field which specifies what variable to switch on
        const switchOnField = fields.On || fields.on || ''
        
        // Pass the switchOnField to children (Case nodes)
        const newContext: TraversalContext = {
          ...context,
          switchOnField: switchOnField || context.switchOnField,
        }
        
        traverse(children, newContext)
        
      } else if (nodeName === 'Case') {
        // Case adds a branch condition based on its match field
        const caseValue = fields.match || ''
        
        let branchCondition = ''
        
        if (caseValue) {
          // Use the switchOnField from context (set by parent Switch)
          if (context.switchOnField) {
            branchCondition = `${context.switchOnField} == "${caseValue}"`
          } else {
            // Fallback: use heuristic based on recent filled actions
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
        // Protocol is the root container - traverse children
        traverse(children, { ...context })
        
      } else if (nodeName === 'Fill Data' && blockTypeAttr === 'Action') {
        // Fill Data is now a container with block_type: Action
        // Look for data_field children to get the field name
        const dataFieldChildren = children.filter(c => c.block_type === 'data_field')
        // Note: constraintChildren could be used for required field validation in the future
        // const constraintChildren = children.filter(c => c.block_type === 'constraint')
        
        // Extract field name from the first data_field child
        if (dataFieldChildren.length > 0) {
          const fieldName = dataFieldChildren[0].name
          const actionName = `fill_${fieldName}`
          const stateVar = `${fieldName}_filled`

          stateVariables.add(stateVar)

          // Build pre-conditions
          const preConditions: string[] = []
          
          for (const branchCond of context.branchConditions) {
            preConditions.push(`state.${branchCond}`)
          }
          
          for (const completedAction of context.completedActions) {
            preConditions.push(`state.${completedAction} == True`)
          }
          
          preConditions.push(`state.${stateVar} == False`)

          // Post-effects
          const postEffects = [`state.${stateVar} = True`]

          actions.push({
            Action: {
              cost: 1,
              name: actionName,
              pre_conditions: preConditions,
              post_effects: postEffects,
            },
          })

          // Add to completed actions for subsequent nodes
          context.completedActions = [...context.completedActions, stateVar]
        }
        
      } else {
        // Generic container - traverse children
        traverse(children, { ...context })
      }
    }

    // Start traversal with empty context
    const initialContext: TraversalContext = {
      completedActions: [],
      branchConditions: [],
    }

    traverse(diagram, initialContext)

    // Build StartState with all discovered state variables
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

    // Also add any variables referenced in branch conditions
    for (const action of actions) {
      for (const preCond of action.Action.pre_conditions) {
        // Extract variable names from conditions like "state.vehicle_types == \"Bobtail Truck\""
        const match = preCond.match(/state\.(\w+)\s*==/)
        if (match && match[1] && !startState.hasOwnProperty(match[1])) {
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

  } catch (err) {
    return { yaml: '', error: `PlanSpace transformation error: ${err}` }
  }
}

/**
 * Simplified transformer that takes parsed flow object directly
 */
export function flowObjectToPlanSpace(diagram: FlowBlock[]): { yaml: string; error?: string } {
  try {
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

      // Handle "Fill Data" or "Fill Data (XXX)" variations
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

        const postEffects = [`state.${stateVar} = True`]

        actions.push({
          Action: {
            cost: 1,
            name: actionName,
            pre_conditions: preConditions,
            post_effects: postEffects,
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
      } else {
        // Handle other leaf types as generic fill actions
        const fieldName = fields.name || nodeName.toLowerCase().replace(/\s+/g, '_')
        const actionName = fieldName
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

        const postEffects = [`state.${stateVar} = True`]

        actions.push({
          Action: {
            cost: 1,
            name: actionName,
            pre_conditions: preConditions,
            post_effects: postEffects,
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
        // Extract the "On" field which specifies what variable to switch on
        const switchOnField = fields.On || fields.on || ''
        
        // Pass the switchOnField to children (Case nodes)
        const newContext: TraversalContext = {
          ...context,
          switchOnField: switchOnField || context.switchOnField,
        }
        
        traverse(children, newContext)
        
      } else if (nodeName === 'Case') {
        const caseValue = fields.match || ''
        let branchCondition = ''
        
        if (caseValue) {
          // Use the switchOnField from context (set by parent Switch)
          if (context.switchOnField) {
            branchCondition = `${context.switchOnField} == "${caseValue}"`
          } else {
            // Fallback: use heuristic based on recent filled actions
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
        
      } else if (nodeName === 'Fill Data' && blockTypeAttr === 'Action') {
        // Fill Data is now a container with block_type: Action
        // Look for data_field children to get the field name
        const dataFieldChildren = children.filter(c => c.block_type === 'data_field')
        
        // Extract field name from the first data_field child
        if (dataFieldChildren.length > 0) {
          const fieldName = dataFieldChildren[0].name
          const actionName = `fill_${fieldName}`
          const stateVar = `${fieldName}_filled`

          stateVariables.add(stateVar)

          // Build pre-conditions
          const preConditions: string[] = []
          
          for (const branchCond of context.branchConditions) {
            preConditions.push(`state.${branchCond}`)
          }
          
          for (const completedAction of context.completedActions) {
            preConditions.push(`state.${completedAction} == True`)
          }
          
          preConditions.push(`state.${stateVar} == False`)

          // Post-effects
          const postEffects = [`state.${stateVar} = True`]

          actions.push({
            Action: {
              cost: 1,
              name: actionName,
              pre_conditions: preConditions,
              post_effects: postEffects,
            },
          })

          // Add to completed actions for subsequent nodes
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

  } catch (err) {
    return { yaml: '', error: `PlanSpace transformation error: ${err}` }
  }
}
