# AI Context Architecture

This document describes how the AI assistant's context is constructed from YAML definition files.

## Overview

The AI assistant uses a **context assembly system** that dynamically builds prompts from workspace-specific YAML files. This allows the AI to understand the block types, field definitions, constraints, and patterns for each workspace.

## Directory Structure

```
app/public/ai_context/
├── _workspace_actions.yaml      # Workspace-level context for "actions"
├── _workspace_protocols.yaml    # Workspace-level context for "protocols"
├── _EXAMPLE_BLOCK.yaml          # Template for creating new block contexts
├── _PROMPT_TEMPLATE.md          # Reference for prompt structure
├── actions/                     # Block definitions for "actions" workspace
│   ├── Action.yaml
│   ├── Card.yaml
│   ├── field.yaml
│   ├── intent.yaml
│   └── ... (one file per block type)
└── protocols/                   # Block definitions for "protocols" workspace
    ├── Protocol.yaml
    ├── Switch.yaml
    ├── Case.yaml
    └── ... (one file per block type)
```

## File Naming Conventions

| Pattern | Purpose |
|---------|---------|
| `_workspace_{name}.yaml` | Workspace-level context (overview, patterns, rules) |
| `_*.yaml` or `_*.md` | Meta files (templates, examples) - skipped during assembly |
| `{BlockName}.yaml` | Block-specific context file |

## Context Assembly Process

The `contextBuilder.ts` service (`api/src/services/contextBuilder.ts`) assembles the AI's system prompt:

### Step 1: Load Workspace Context

```typescript
loadWorkspaceContext(workspace: string)
```

Reads `_workspace_{workspace}.yaml` which contains:
- **Purpose**: What this workspace is for
- **Use cases**: Typical scenarios
- **Flow patterns**: Common block arrangements
- **Key concepts**: Domain-specific terminology
- **Block inventory**: List of available blocks
- **Generation rules**: AI guidelines
- **Example flows**: Complete YAML examples

### Step 2: Load Block Context Files

```typescript
loadBlockContextFiles(workspace: string)
```

Reads all `*.yaml` files in the workspace subdirectory (e.g., `actions/`), excluding:
- Files starting with `_` (meta files)
- Non-YAML files

Each block file contains:
- **Intent**: What the block is for
- **Description**: Detailed explanation
- **Fields**: Input field definitions
- **Structural constraints**: Allowed children, parents
- **Relationships**: Related blocks
- **Examples**: Usage examples
- **Common mistakes**: What to avoid

### Step 3: Build System Prompt

```typescript
buildSystemPrompt(workspace: string, currentFlowYaml?: string)
```

Assembles the final prompt with this structure:

```
┌─────────────────────────────────────────────────────────────┐
│ ROLE DEFINITION                                             │
│ "You are a flow builder assistant for the X workspace..."   │
├─────────────────────────────────────────────────────────────┤
│ OUTPUT FORMAT INSTRUCTIONS                                  │
│ - YAML structure requirements                               │
│ - Key rules (type, name, fields, children)                  │
├─────────────────────────────────────────────────────────────┤
│ WORKSPACE CONTEXT                                           │
│ - Content from _workspace_{name}.yaml                       │
├─────────────────────────────────────────────────────────────┤
│ AVAILABLE BLOCKS                                            │
│ - All block definitions from {workspace}/*.yaml             │
│ - Each wrapped in ### BlockName.yaml + code block           │
├─────────────────────────────────────────────────────────────┤
│ CURRENT USER FLOW                                           │
│ - User's current canvas YAML (if any)                       │
├─────────────────────────────────────────────────────────────┤
│ INSTRUCTIONS                                                │
│ - Generation guidelines                                     │
│ - Best practices                                            │
└─────────────────────────────────────────────────────────────┘
```

## Block Context File Structure

Each block's YAML file follows this schema:

```yaml
# =============================================================================
# AI CONTEXT: {BlockName} Block
# Workspace: {workspace}
# =============================================================================

block_name: "{BlockName}"
block_type: container | leaf
workspace: {workspace}

# -----------------------------------------------------------------------------
# CORE INTENT
# -----------------------------------------------------------------------------
intent: |
  Brief description of what this block does.

description: |
  Detailed explanation of the block's purpose and behavior.

# -----------------------------------------------------------------------------
# SEMANTIC ROLE
# -----------------------------------------------------------------------------
semantic_role: container | constraint | data | flow_control

# -----------------------------------------------------------------------------
# FIELD DEFINITIONS
# -----------------------------------------------------------------------------
fields:
  field_name:
    intent: "What this field is for"
    description: "Detailed explanation"
    value_type: text | dropdown | expression
    required: true | false
    options: ["option1", "option2"]  # For dropdowns
    default_behavior: "What happens if not specified"
    examples:
      - "example_value"

# -----------------------------------------------------------------------------
# STRUCTURAL CONSTRAINTS
# -----------------------------------------------------------------------------
allowed_children:
  - ChildBlockType

required_children:
  min: 0
  max: null
  types: [RequiredChildType]

allowed_parents:
  - ParentBlockType

# -----------------------------------------------------------------------------
# RELATIONSHIPS
# -----------------------------------------------------------------------------
relationships:
  requires:
    - OtherBlock  # Must exist together
  pairs_with:
    - RelatedBlock  # Often used together
  typically_preceded_by: BlockType
  typically_followed_by: BlockType

# -----------------------------------------------------------------------------
# USAGE EXAMPLES
# -----------------------------------------------------------------------------
examples:
  - name: "Example Name"
    description: "What this example shows"
    yaml: |
      BlockName:
        - field_name: value

# -----------------------------------------------------------------------------
# COMMON MISTAKES
# -----------------------------------------------------------------------------
common_mistakes:
  - mistake: "Description of mistake"
    correction: "How to fix it"
    example_wrong: |
      Wrong YAML
    example_correct: |
      Correct YAML

# -----------------------------------------------------------------------------
# GENERATION HINTS
# -----------------------------------------------------------------------------
generation_hints:
  use_when:
    - "Condition when to use this block"
  do_not_use_when:
    - "Condition when NOT to use this block"
  keywords:
    - "word"  # Trigger words in user prompts
```

## Adding a New Block Context

1. **Create the file**: `app/public/ai_context/{workspace}/{BlockName}.yaml`

2. **Use the template**: Copy `_EXAMPLE_BLOCK.yaml` as a starting point

3. **Fill in all sections**:
   - Intent and description
   - Field definitions with examples
   - Structural constraints (parents/children)
   - Usage examples
   - Common mistakes

4. **Test**: The block will be automatically included next time the AI is queried

## Adding a New Workspace

1. **Create workspace context**: `app/public/ai_context/_workspace_{name}.yaml`

2. **Create block directory**: `app/public/ai_context/{name}/`

3. **Add block files**: One `.yaml` file per block type

4. **Register workspace**: Add to `app/public/workspaces.yaml`

## API Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend  │────▶│  POST /api/ai/   │────▶│ contextBuilder  │
│  AIChatTab  │     │   chat/stream    │     │ .ts             │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │                         │
                           │                         ▼
                           │               ┌─────────────────────┐
                           │               │ Load YAML files:    │
                           │               │ - Workspace context │
                           │               │ - Block definitions │
                           │               └─────────────────────┘
                           │                         │
                           ▼                         ▼
                    ┌──────────────────┐     ┌─────────────────┐
                    │ Anthropic Claude │◀────│ System Prompt   │
                    │     API          │     │ (assembled)     │
                    └──────────────────┘     └─────────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_CONTEXT_PATH` | Path to ai_context directory | `../../../app/public/ai_context` |
| `ANTHROPIC_API_KEY` | Claude API key | Required |

## Key Files

| File | Purpose |
|------|---------|
| `api/src/services/contextBuilder.ts` | Assembles AI context from YAML files |
| `api/src/routes/ai.ts` | API endpoints for AI chat |
| `app/src/components/AIChatTab.tsx` | Frontend chat interface |
| `app/public/ai_context/` | YAML context definitions |

## Best Practices for Context Files

1. **Be comprehensive**: Include all valid patterns and edge cases
2. **Use examples**: YAML examples are the most useful part for the AI
3. **Document mistakes**: Common mistakes help the AI avoid errors
4. **Include keywords**: Generation hints help the AI recognize when to use blocks
5. **Keep consistent**: Follow the same structure across all block files
6. **Test iteratively**: Add context and test with real prompts
