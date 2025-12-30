# AI Context Generation Prompt

Copy everything below this line and paste it into an AI assistant (like Claude or ChatGPT) to generate AI context files for your blocks.

---

I need you to create an AI context file for a block in my flow builder application.

## TEMPLATE TO FOLLOW

Here is the template structure you must follow:

```yaml
# =============================================================================
# AI CONTEXT TEMPLATE FOR BLOCK DEFINITIONS
# =============================================================================
# This file serves as a reference template for creating AI context files.
# Each block in the workspace should have its own AI context file following
# this structure. AI can use this template to understand and generate
# context files for other blocks.
#
# File naming convention: {BlockName}.yaml (spaces replaced with underscores)
# Example: "Fill Data" → "Fill_Data.yaml"
# =============================================================================

# -----------------------------------------------------------------------------
# BLOCK IDENTIFICATION
# -----------------------------------------------------------------------------
block_name: "ExampleBlock"           # Must match the 'name' in workspace YAML
block_type: container                # container | leaf
workspace: protocols                 # Which workspace this block belongs to

# -----------------------------------------------------------------------------
# CORE INTENT (Required)
# -----------------------------------------------------------------------------
intent: |
  A clear, concise description of what this block accomplishes in the flow.
  This should answer: "What is the purpose of using this block?"
  
  Example: "Creates conditional branching based on a variable's value,
  routing the flow to different Case children depending on the match."

description: |
  A more detailed explanation of the block's behavior, how it works,
  and any important details an AI should understand when using it.
  
  This can include:
  - How the block processes data
  - What happens when the block is executed
  - Any side effects or state changes

# -----------------------------------------------------------------------------
# SEMANTIC ROLE (Required)
# -----------------------------------------------------------------------------
# Categorizes the block's high-level function in a flow
semantic_role: branching  # One of:
                          # - root           : Top-level container (Protocol, Action)
                          # - branching      : Creates conditional paths (Switch, Case)
                          # - data_collection: Collects user input (Fill Data, field)
                          # - decision       : Makes a determination (Access Decision)
                          # - constraint     : Adds rules/requirements (required, Pre-Condition)
                          # - action         : Performs an operation (on_success, Post Effect)
                          # - grouping       : Organizes other blocks (Policy, Pre-Conditions List)

# -----------------------------------------------------------------------------
# FIELD DEFINITIONS (Required if block has fields)
# -----------------------------------------------------------------------------
fields:
  field_name_1:
    intent: "What this field is used for"
    description: "Detailed explanation of the field's purpose and how it affects behavior"
    value_type: text          # text | number | boolean | block_reference | expression
    required: true            # Is this field required?
    default_behavior: |
      What happens if this field is left empty or uses its default value
    valid_values:             # Optional: If field has specific valid values
      - value1: "Explanation of what this value means"
      - value2: "Explanation of what this value means"
    examples:
      - "example_value_1"
      - "example_value_2"

# -----------------------------------------------------------------------------
# STRUCTURAL CONSTRAINTS (Required for containers)
# -----------------------------------------------------------------------------
allowed_children:           # What blocks can be direct children (for containers)
  - BlockName1
  - BlockName2
  - block_type: data_field  # Can also reference by block_type

required_children:          # Minimum requirements for children
  min: 2                    # Minimum number of children
  max: null                 # Maximum (null = unlimited)
  types:                    # Which types are required
    - Case                  # Example: Switch requires at least 2 Case children

allowed_parents:            # Where this block can be placed
  - ParentBlock1
  - ParentBlock2
  - root                    # 'root' means it can be at the top level

# -----------------------------------------------------------------------------
# RESTRICTIONS & RULES (Required)
# -----------------------------------------------------------------------------
restrictions:
  - "Clear statement of what NOT to do with this block"
  - "Another restriction or rule"
  - "Example: 'On field must reference a data_field that appears earlier in the flow'"
  - "Example: 'Each Case match value must be unique within the same Switch'"

# -----------------------------------------------------------------------------
# RELATIONSHIPS (Recommended)
# -----------------------------------------------------------------------------
relationships:
  requires:                 # Blocks that must exist for this block to work
    - data_field           # Example: Switch requires a data_field to switch on
  
  pairs_with:              # Blocks commonly used together
    - Case                 # Example: Switch always pairs with Case
  
  typically_preceded_by:   # What usually comes before this block
    - Fill Data
  
  typically_followed_by:   # What usually comes after this block
    - Access Decision

# -----------------------------------------------------------------------------
# USAGE EXAMPLES (Required - Critical for AI learning)
# -----------------------------------------------------------------------------
examples:
  - name: "Basic Usage"
    description: "The simplest way to use this block"
    yaml: |
      ExampleBlock:
        - field_name_1: value1
        - ChildBlock:
            - child_field: value

  - name: "Complete Example"
    description: "A more comprehensive example with all features"
    yaml: |
      ExampleBlock:
        - field_name_1: value1
        - field_name_2: value2
        - ChildBlock:
            - nested_content

  - name: "In Context"
    description: "How this block fits into a larger flow"
    yaml: |
      Protocol:
        - PrecedingBlock: ...
        - ExampleBlock:
            - field_name_1: value1
        - FollowingBlock: ...

# -----------------------------------------------------------------------------
# COMMON MISTAKES (Recommended)
# -----------------------------------------------------------------------------
common_mistakes:
  - mistake: "Description of the mistake"
    correction: "How to fix it"
    example_wrong: |
      # Wrong way
      ExampleBlock:
        - wrong_usage
    example_correct: |
      # Correct way
      ExampleBlock:
        - correct_usage

# -----------------------------------------------------------------------------
# GENERATION HINTS (Optional - for AI flow generation)
# -----------------------------------------------------------------------------
generation_hints:
  use_when:
    - "The user needs to branch based on a condition"
    - "The flow requires different paths for different scenarios"
  
  do_not_use_when:
    - "There is only one possible path"
    - "The condition is binary (use If/Else instead if available)"
  
  keywords:                 # Keywords in user request that suggest this block
    - "depending on"
    - "based on"
    - "if the value is"
    - "switch"
    - "branch"
```

---

## COMPLETED EXAMPLE

Here is an example of a fully completed context file for the "Switch" block:

```yaml
# =============================================================================
# AI CONTEXT: Switch Block
# Workspace: Protocols
# =============================================================================

block_name: "Switch"
block_type: container
workspace: protocols

# -----------------------------------------------------------------------------
# CORE INTENT
# -----------------------------------------------------------------------------
intent: |
  Creates conditional branching based on a variable's value, routing the flow
  to different Case children depending on which Case's match value equals
  the variable specified in the "On" field.

description: |
  The Switch block is a control flow container that evaluates a variable
  (specified in its "On" field) and directs execution to the appropriate
  Case child based on value matching.
  
  Key behaviors:
  - The "On" field should reference a data_field that was collected earlier
  - Each child Case block has a "match" field with a value to compare against
  - When the variable's value matches a Case's match value, that branch executes
  - Cases are visually displayed side-by-side (horizontal layout)
  - Only one Case branch will execute per flow execution

# -----------------------------------------------------------------------------
# SEMANTIC ROLE
# -----------------------------------------------------------------------------
semantic_role: branching

# -----------------------------------------------------------------------------
# FIELD DEFINITIONS
# -----------------------------------------------------------------------------
fields:
  On:
    intent: "Specifies the variable name to evaluate for branching"
    description: |
      The "On" field contains the name of a data_field that has been
      collected earlier in the flow. The Switch will compare this
      variable's value against each Case's match value to determine
      which branch to take.
    value_type: block_reference
    required: true
    default_behavior: |
      If left empty, the Switch cannot function properly. The UI allows
      dragging a data_field block onto the Switch to auto-populate this field.
    examples:
      - "vehicle_type"
      - "truck_number"
      - "cdl_number"

# -----------------------------------------------------------------------------
# STRUCTURAL CONSTRAINTS
# -----------------------------------------------------------------------------
allowed_children:
  - Case

required_children:
  min: 2
  max: null
  types:
    - Case

allowed_parents:
  - Protocol
  - Case  # Switches can be nested inside Cases for multi-level branching

# -----------------------------------------------------------------------------
# RESTRICTIONS & RULES
# -----------------------------------------------------------------------------
restrictions:
  - "The 'On' field must reference a data_field that has been collected earlier in the flow"
  - "Each Case child must have a unique 'match' value within the same Switch"
  - "A Switch must have at least 2 Case children to be meaningful"
  - "Only Case blocks can be direct children of a Switch"
  - "The referenced variable must be a string type for proper matching"

# -----------------------------------------------------------------------------
# RELATIONSHIPS
# -----------------------------------------------------------------------------
relationships:
  requires:
    - data_field  # A data_field must be referenced in the "On" field
    - Fill Data   # The data_field should be collected via Fill Data first
  
  pairs_with:
    - Case  # Switch always contains Case children
  
  typically_preceded_by:
    - Fill Data  # Usually follows data collection to branch on that data
  
  typically_followed_by: null  # Switch doesn't have siblings after it typically

# -----------------------------------------------------------------------------
# USAGE EXAMPLES
# -----------------------------------------------------------------------------
examples:
  - name: "Basic Switch on Vehicle Type"
    description: "Branch based on what type of vehicle is entering"
    yaml: |
      Switch:
        - On: vehicle_type
        - Case:
            - match: truck
        - Case:
            - match: bobtail

  - name: "Switch with Complete Cases"
    description: "Each case has its own data collection and decision"
    yaml: |
      Switch:
        - On: vehicle_type
        - Case:
            - match: truck
            - Fill Data:
                - truck_number
            - Fill Data:
                - trailer_number
            - Access Decision:
                - access: Granted
        - Case:
            - match: bobtail
            - Fill Data:
                - truck_number
            - Access Decision:
                - access: Granted
        - Case:
            - match: personal
            - Access Decision:
                - access: Denied

  - name: "In Full Protocol Context"
    description: "How Switch fits into a complete flow"
    yaml: |
      Protocol:
        - Fill Data:
            - vehicle_type
        - Switch:
            - On: vehicle_type
            - Case:
                - match: truck
                - Access Decision:
                    - access: Granted
            - Case:
                - match: visitor
                - Access Decision:
                    - access: Denied

# -----------------------------------------------------------------------------
# COMMON MISTAKES
# -----------------------------------------------------------------------------
common_mistakes:
  - mistake: "Referencing a data_field that hasn't been collected yet"
    correction: "Always place Fill Data with the data_field before the Switch"
    example_wrong: |
      Protocol:
        - Switch:
            - On: vehicle_type  # Error: vehicle_type not collected!
            - Case:
                - match: truck
    example_correct: |
      Protocol:
        - Fill Data:
            - vehicle_type  # Collected first
        - Switch:
            - On: vehicle_type  # Now it's valid
            - Case:
                - match: truck

  - mistake: "Using duplicate match values in Cases"
    correction: "Each Case must have a unique match value"
    example_wrong: |
      Switch:
        - On: vehicle_type
        - Case:
            - match: truck
        - Case:
            - match: truck  # Error: Duplicate!
    example_correct: |
      Switch:
        - On: vehicle_type
        - Case:
            - match: truck
        - Case:
            - match: bobtail  # Unique value

# -----------------------------------------------------------------------------
# GENERATION HINTS
# -----------------------------------------------------------------------------
generation_hints:
  use_when:
    - "The user needs different behavior based on a collected value"
    - "There are multiple distinct paths/scenarios to handle"
    - "The user mentions 'depending on', 'based on', 'if/else'"
    - "Different vehicle types or user types need different treatment"
  
  do_not_use_when:
    - "There is only one path regardless of input"
    - "The decision is binary (consider simpler patterns)"
    - "No data has been collected to switch on"
  
  keywords:
    - "depending on"
    - "based on"
    - "if the type is"
    - "different for"
    - "branch"
    - "switch"
    - "when X is Y"
    - "for trucks... for visitors..."
```

---

## WORKSPACE CONTEXT

This block belongs to the **Protocols** workspace. Here is the workspace context:

```yaml
workspace_name: Protocols

purpose: |
  The Protocols workspace is designed for building access control protocols
  for facility entry. Users create visual flows that define how to collect
  information from visitors/drivers and make access decisions based on that data.

domain: "Facility access control, gate entry, security protocols"

use_cases:
  - "Creating entry protocols for truck yards"
  - "Defining access rules based on vehicle type"
  - "Collecting driver credentials and validating them"
  - "Branching flows based on different visitor types"
  - "Making grant/deny access decisions"

typical_flow_structure: |
  Protocol
    └── Fill Data (collect initial data, e.g., vehicle_type)
    └── Switch (branch based on collected data)
        ├── Case (value1)
        │   └── Fill Data (collect specific data)
        │   └── Access Decision (grant/deny)
        └── Case (value2)
            └── Fill Data (collect different data)
            └── Access Decision (grant/deny)

blocks:
  containers:
    - name: Protocol
      role: "Root container for the entire flow"
    - name: Switch
      role: "Creates conditional branching based on a variable"
    - name: Case
      role: "Represents one branch within a Switch"
    - name: Fill Data
      role: "Container for collecting a piece of data"

  leaves:
    - name: Access Decision
      role: "Terminal block that grants or denies access"
    - name: vehicle_type
      role: "Data field for vehicle classification"
    - name: truck_number
      role: "Data field for truck identification number"
    - name: trailer_number
      role: "Data field for trailer identification number"
    - name: license_plate
      role: "Data field for vehicle license plate"
    - name: cdl_number
      role: "Data field for commercial driver's license"
    - name: required
      role: "Constraint that marks a field as mandatory"

generation_rules:
  - "Every Protocol must end with at least one Access Decision"
  - "Data fields must be collected (via Fill Data) before being referenced in Switch"
  - "Each Case in a Switch must have a unique match value"
  - "Switch blocks should have at least 2 Case children to be meaningful"
  - "The Protocol block is always the root - nothing can contain it"
  - "Fill Data containers should contain exactly one data_field"
```

---

## BLOCK DEFINITION

Here is the block definition from the workspace YAML file that I need you to create context for:

```yaml
# REPLACE THIS SECTION WITH YOUR BLOCK DEFINITION
# Example:
- type: leaf
  name: truck_number
  block_type: data_field
```

---

## YOUR TASK

Create a complete AI context file for the block specified above, following the template structure.

**Key requirements:**
1. Fill in ALL sections from the template
2. Provide meaningful `intent` and `description` (not just "TODO")
3. Include realistic `examples` showing how to use the block
4. Add relevant `restrictions` and `generation_hints`
5. Make sure `allowed_parents` and `allowed_children` are accurate for this workspace
6. Include at least 2-3 examples in the examples section
7. Add common_mistakes if applicable

**Output the complete YAML file content.**
