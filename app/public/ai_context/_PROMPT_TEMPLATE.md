# AI Context Generation Prompt Template

Use this prompt to have an AI generate context files for the remaining blocks.

---

## Prompt to Copy & Paste

```
I need you to create an AI context file for a block in my flow builder application.

## TEMPLATE TO FOLLOW
Here is the template structure you must follow (_EXAMPLE_BLOCK.yaml):

[PASTE CONTENTS OF _EXAMPLE_BLOCK.yaml HERE]

---

## COMPLETED EXAMPLE
Here is an example of a fully completed context file (Switch.yaml):

[PASTE CONTENTS OF Switch.yaml HERE]

---

## WORKSPACE CONTEXT
This block belongs to the [Protocols/Actions] workspace. Here is the workspace context:

[PASTE CONTENTS OF _workspace_protocols.yaml OR _workspace_actions.yaml HERE]

---

## BLOCK DEFINITION
Here is the block definition from the workspace YAML file:

```yaml
- type: [container/leaf]
  name: [BLOCK NAME]
  fields:
    - name: [field_name]
      # ... other field properties
```

---

## YOUR TASK
Create a complete AI context file for the "[BLOCK NAME]" block following the template structure.

Key requirements:
1. Fill in ALL sections from the template
2. Provide meaningful `intent` and `description` (not just "TODO")
3. Include realistic `examples` showing how to use the block
4. Add relevant `restrictions` and `generation_hints`
5. Make sure `allowed_parents` and `allowed_children` are accurate for this workspace
6. Include at least 2-3 examples in the examples section
7. Add common_mistakes if applicable

Output the complete YAML file content.
```

---

## Example Filled-In Prompt for `truck_number` Block

```
I need you to create an AI context file for a block in my flow builder application.

## TEMPLATE TO FOLLOW
Here is the template structure you must follow (_EXAMPLE_BLOCK.yaml):

# =============================================================================
# AI CONTEXT TEMPLATE FOR BLOCK DEFINITIONS
# =============================================================================
[... full contents of _EXAMPLE_BLOCK.yaml ...]

---

## COMPLETED EXAMPLE
Here is an example of a fully completed context file (Switch.yaml):

# =============================================================================
# AI CONTEXT: Switch Block
# Workspace: Protocols
# =============================================================================
[... full contents of Switch.yaml ...]

---

## WORKSPACE CONTEXT
This block belongs to the Protocols workspace. Here is the workspace context:

workspace_name: Protocols

purpose: |
  The Protocols workspace is designed for building access control protocols
  for facility entry. Users create visual flows that define how to collect
  information from visitors/drivers and make access decisions based on that data.
[... rest of _workspace_protocols.yaml ...]

---

## BLOCK DEFINITION
Here is the block definition from the workspace YAML file:

```yaml
- type: leaf
  name: truck_number
  block_type: data_field
```

---

## YOUR TASK
Create a complete AI context file for the "truck_number" block following the template structure.

Key requirements:
1. Fill in ALL sections from the template
2. Provide meaningful `intent` and `description` (not just "TODO")
3. Include realistic `examples` showing how to use the block
4. Add relevant `restrictions` and `generation_hints`
5. Make sure `allowed_parents` and `allowed_children` are accurate for this workspace
6. Include at least 2-3 examples in the examples section
7. Add common_mistakes if applicable

Output the complete YAML file content.
```

---

## Blocks Still Needing Context Files

### Protocols Workspace
| Block Name | Type | File to Create |
|------------|------|----------------|
| truck_number | leaf (data_field) | `protocols/truck_number.yaml` |
| trailer_number | leaf (data_field) | `protocols/trailer_number.yaml` |
| license_plate | leaf (data_field) | `protocols/license_plate.yaml` |
| cdl_number | leaf (data_field) | `protocols/cdl_number.yaml` |

### Actions Workspace
| Block Name | Type | File to Create |
|------------|------|----------------|
| Card | container | `actions/Card.yaml` |
| delivery | container | `actions/delivery.yaml` |
| interaction | container | `actions/interaction.yaml` |
| Policy | container | `actions/Policy.yaml` |
| Pre-Conditions List | container | `actions/Pre-Conditions List.yaml` |
| post_effects | container | `actions/post_effects.yaml` |
| intent | leaf | `actions/intent.yaml` |
| field | leaf | `actions/field.yaml` |
| on_success | leaf | `actions/on_success.yaml` |
| on_error | leaf | `actions/on_error.yaml` |
| Pre-Condition | leaf | `actions/Pre-Condition.yaml` |
| Post Effect | leaf | `actions/Post_Effect.yaml` |
| Timeout | leaf | `actions/Timeout.yaml` |

---

## Tips for Best Results

1. **Provide the full template** - Don't truncate the example files
2. **Include workspace context** - Helps AI understand the domain
3. **Be specific about the block type** - container vs leaf affects constraints
4. **Review the output** - Verify `allowed_parents` and `allowed_children` are correct
5. **Add domain knowledge** - If you know more about the block's purpose, include it

---

## Quick Copy Commands

To get the contents of required files:

```bash
# Get template
cat app/public/ai_context/_EXAMPLE_BLOCK.yaml

# Get Switch example
cat app/public/ai_context/protocols/Switch.yaml

# Get workspace context
cat app/public/ai_context/_workspace_protocols.yaml
cat app/public/ai_context/_workspace_actions.yaml
```
