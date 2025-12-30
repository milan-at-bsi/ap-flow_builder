# Front-End Architecture Overview

The front-end is a **React + TypeScript** application using **React Flow** as the visual canvas library for building block-based diagrams.

---

## Shared Infrastructure (All Workspaces)

These components are **shared across all workspaces** and provide the core functionality:

| Component | File | Purpose |
|-----------|------|---------|
| **ContainerBlock** | `app/src/blocks/ContainerBlock.tsx` | Visual rendering for all container-type blocks |
| **LeafBlock** | `app/src/blocks/LeafBlock.tsx` | Visual rendering for all leaf-type blocks |
| **Layout Engine** | `app/src/blocks/layout.ts` | Calculates positions, dimensions, handles nesting, horizontal/vertical layout |
| **Serialization** | `app/src/blocks/serialization.ts` | Import/Export YAML ↔ React Flow nodes |
| **PlanSpace Transformer** | `app/src/blocks/planspaceTransformer.ts` | Converts flow diagrams to PlanSpace YAML format |
| **API Client** | `app/src/api.ts` | Handles persistence (save/load flows to backend) |
| **Theme/Styling** | `app/src/index.css` | CSS variables for dark/light themes, colors |
| **Main App** | `app/src/App.tsx` | Workspace switching, drag-drop, canvas management |

---

## Workspace Configuration System

Workspaces are defined via **YAML configuration files** that specify the available blocks for each workspace.

### Workspace Manifest

**`app/public/workspaces.yaml`** - Lists all available workspaces:

```yaml
workspaces:
  - name: Actions
    file: workspace_actions.yaml
  - name: Protocols
    file: workspace_protocols.yaml
```

---

## Workspace Definitions

### Actions Workspace (`workspace_actions.yaml`)

Designed for building **granular action definitions** with detailed configurations:

**Containers:**
- `Action` - Root action container with action field
- `Card` - Card container with card_id field
- `delivery` - Delivery container
- `interaction` - Interaction container with type options
- `Policy` - Policy container
- `pre_conditions` - Pre-conditions container
- `post_effects` - Post-effects container

**Leaves:**
- `intent` - Intent specification (collect, acknowledge)
- `field` - Field definition with field, label, prompt
- `on_success` / `on_error` - Success/error handlers
- `Pre-Condition` / `Post Effect` - Policy conditions
- `Timeout` - Timeout configuration

**Focus:** Detailed action structures with pre/post conditions, fields, timeouts

---

### Protocols Workspace (`workspace_protocols.yaml`)

Designed for building **high-level protocol flows** with branching logic:

**Containers:**
- `Protocol` - Root protocol container
- `Switch` - Branching container with "On" field for switch variable
- `Case` - Branch case with `map_placement: horizontal` for side-by-side layout
- `Fill Data` - Data collection action (`block_type: Action`)

**Leaves:**
- `Access Decision` - Access granted/denied decision
- `vehicle_type`, `truck_number`, `trailer_number`, `license_plate`, `cdl_number` - Data fields (`block_type: data_field`)
- `required` - Constraint specification (`block_type: constraint`)

**Focus:** Flow control (Switch/Case), data fields, access decisions

**Special Attributes:**
- `block_type` - Semantic categorization (Action, data_field, constraint)
- `map_placement: horizontal` - Renders sibling blocks side-by-side instead of stacked

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       App.tsx (Main)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Workspace Selector                      │   │
│  │   ┌─────────────┐     ┌──────────────┐              │   │
│  │   │   Actions   │     │  Protocols   │              │   │
│  │   └─────────────┘     └──────────────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Block Definitions (YAML)                   │   │
│  │   • type: container/leaf                             │   │
│  │   • name, fields, block_type, map_placement         │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Shared Rendering Components                 │    │
│  │   ContainerBlock.tsx │ LeafBlock.tsx │ layout.ts   │    │
│  └────────────────────────────────────────────────────┘    │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  React Flow Canvas                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Design Patterns

### 1. Configuration-Driven
Block types are defined in YAML configuration files, not hardcoded in the application. This allows new block types to be added without code changes.

### 2. Pluggable Workspaces
Add new workspaces by:
1. Creating a new YAML file (e.g., `workspace_myworkspace.yaml`)
2. Adding it to the manifest in `workspaces.yaml`

### 3. Shared Rendering
The same React components (`ContainerBlock`, `LeafBlock`) render all blocks. They are configured by data passed from the block definitions.

### 4. Attribute-Based Behavior
Special attributes modify rendering/behavior without code changes:
- `map_placement: horizontal` - Changes layout direction
- `block_type` - Semantic categorization for processing
- `fields` - Dynamic form fields
- `options` - Dropdown options for fields

---

## Data Flow

```
┌──────────────┐    drag/drop    ┌──────────────┐
│   Toolbox    │ ─────────────► │    Canvas    │
│  (blocks)   │                 │ (React Flow) │
└──────────────┘                 └──────────────┘
                                        │
                                        │ Export
                                        ▼
                                 ┌──────────────┐
                                 │  Flow YAML   │
                                 └──────────────┘
                                        │
                                        │ Transform
                                        ▼
                                 ┌──────────────┐
                                 │PlanSpace YAML│
                                 └──────────────┘
```

---

## File Structure

```
app/
├── public/
│   ├── workspaces.yaml          # Workspace manifest
│   ├── workspace_actions.yaml   # Actions workspace blocks
│   └── workspace_protocols.yaml # Protocols workspace blocks
├── src/
│   ├── App.tsx                  # Main application component
│   ├── api.ts                   # Backend API client
│   ├── index.css                # Theme variables & styles
│   ├── main.tsx                 # React entry point
│   └── blocks/
│       ├── ContainerBlock.tsx   # Container block component
│       ├── LeafBlock.tsx        # Leaf block component
│       ├── layout.ts            # Layout calculations
│       ├── serialization.ts     # YAML import/export
│       └── planspaceTransformer.ts # PlanSpace generation
```
