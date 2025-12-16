-- Create database schema
CREATE TABLE IF NOT EXISTS flows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  external_id VARCHAR(255) UNIQUE,
  flow_yaml TEXT,
  plan_yaml TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on external_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_flows_external_id ON flows(external_id);

-- Seed data: Vehicle Access Protocol
INSERT INTO flows (name, external_id, flow_yaml, plan_yaml) VALUES (
  'Vehicle Access Protocol',
  'vehicle-access-v1',
  'diagram:
  Protocol:
    - Fill Data:
        - block_type: Action
        - data_field: vehicle_type
        - required:
            block_type: constraint
            value: "true"
    - Switch:
        - On: vehicle_type
        - Case:
            - match: bobtail
            - Fill Data:
                - block_type: Action
                - data_field: truck_number
                - required:
                    block_type: constraint
                    value: "true"
            - Access Decision:
                access: granted
        - Case:
            - match: truck
            - Fill Data:
                - block_type: Action
                - data_field: truck_number
                - required:
                    block_type: constraint
                    value: "true"
            - Fill Data:
                - block_type: Action
                - data_field: trailer_number
                - required:
                    block_type: constraint
                    value: "true"
            - Access Decision:
                access: granted
        - Case:
            - match: unknown
            - Access Decision:
                access: denied',
  'PlanSpace:
  Actions:
    - Action:
        cost: 1
        name: fill_vehicle_type
        pre_conditions:
          - state.vehicle_type_filled == False
        post_effects:
          - state.vehicle_type_filled = True
    - Action:
        cost: 1
        name: fill_truck_number
        pre_conditions:
          - state.vehicle_type == "bobtail"
          - state.vehicle_type_filled == True
          - state.truck_number_filled == False
        post_effects:
          - state.truck_number_filled = True
    - Action:
        cost: 1
        name: grant_access
        pre_conditions:
          - state.vehicle_type == "bobtail"
          - state.vehicle_type_filled == True
          - state.truck_number_filled == True
        post_effects:
          - state.access_granted = True
          - state.access_denied = False
    - Action:
        cost: 1
        name: fill_truck_number
        pre_conditions:
          - state.vehicle_type == "truck"
          - state.vehicle_type_filled == True
          - state.truck_number_filled == False
        post_effects:
          - state.truck_number_filled = True
    - Action:
        cost: 1
        name: fill_trailer_number
        pre_conditions:
          - state.vehicle_type == "truck"
          - state.vehicle_type_filled == True
          - state.truck_number_filled == True
          - state.trailer_number_filled == False
        post_effects:
          - state.trailer_number_filled = True
    - Action:
        cost: 1
        name: grant_access
        pre_conditions:
          - state.vehicle_type == "truck"
          - state.vehicle_type_filled == True
          - state.truck_number_filled == True
          - state.trailer_number_filled == True
        post_effects:
          - state.access_granted = True
          - state.access_denied = False
    - Action:
        cost: 1
        name: deny_access
        pre_conditions:
          - state.vehicle_type == "unknown"
          - state.vehicle_type_filled == True
        post_effects:
          - state.access_granted = False
          - state.access_denied = True
  GoalState:
    expression: (state.access_granted == True) or (state.access_denied == True)
  StartState:
    state:
      access_denied: false
      access_granted: false
      trailer_number_filled: false
      truck_number_filled: false
      vehicle_type: unknown
      vehicle_type_filled: false'
) ON CONFLICT (external_id) DO NOTHING;
