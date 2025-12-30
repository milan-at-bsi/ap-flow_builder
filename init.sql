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

-- Seed data: Protocol workspace example - Base Case Truck
INSERT INTO flows (name, external_id, flow_yaml, plan_yaml) VALUES (
  'Protocol: Base Case Truck',
  '111',
  'diagram:
  Protocol:
    - Fill Data:
        - block_type: Action
        - data_field: vehicle_type
    - Switch:
        - On: vehicle_type
        - Case:
            - match: bobtail
            - Fill Data:
                - block_type: Action
                - data_field: truck_number
            - Access Decision:
                access: Granted
        - Case:
            - match: truck and trailer
            - Fill Data:
                - block_type: Action
                - data_field: truck_number
            - Fill Data:
                - block_type: Action
                - data_field: trailer_number
            - Access Decision:
                access: Granted
        - Case:
            - match: pedestrian
            - Access Decision:
                access: Denied
        - Case:
            - match: other
            - Access Decision:
                access: Denied',
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
          - state.vehicle_type == "truck and trailer"
          - state.vehicle_type_filled == True
          - state.truck_number_filled == False
        post_effects:
          - state.truck_number_filled = True
    - Action:
        cost: 1
        name: fill_trailer_number
        pre_conditions:
          - state.vehicle_type == "truck and trailer"
          - state.vehicle_type_filled == True
          - state.truck_number_filled == True
          - state.trailer_number_filled == False
        post_effects:
          - state.trailer_number_filled = True
    - Action:
        cost: 1
        name: grant_access
        pre_conditions:
          - state.vehicle_type == "truck and trailer"
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
          - state.vehicle_type == "pedestrian"
          - state.vehicle_type_filled == True
        post_effects:
          - state.access_granted = False
          - state.access_denied = True
    - Action:
        cost: 1
        name: deny_access
        pre_conditions:
          - state.vehicle_type == "other"
          - state.vehicle_type_filled == True
        post_effects:
          - state.access_granted = False
          - state.access_denied = True
  GoalState:
    expression: (state.access_granted == True) or (state.access_denied == True)
  StartState:
    state:
      vehicle_type_filled: false
      truck_number_filled: false
      access_granted: false
      access_denied: false
      trailer_number_filled: false
      vehicle_type: unknown'
) ON CONFLICT (external_id) DO NOTHING;

-- Seed data: Actions workspace example - Base Case Truck Number 2 Cards
INSERT INTO flows (name, external_id, flow_yaml, plan_yaml) VALUES (
  'Action: Base Case Truck Number 2 cards',
  '2222',
  'diagram:
  Action:
    - action: collect_truck_number
    - Goal State:
        goal_state: state.acknowledged == True
    - Goal State:
        goal_state: state.flow_timeout == True
    - Card:
        - card_id: collect_truck_num_v1
        - State List:
            - state:
                truck_number_filled: "False"
            - state:
                collect_truck_num_v1_timeout: "False"
        - delivery:
            - intent: collect
            - interaction:
                - interaction_type: input.text
                - field:
                    field: truck_number
                    label: Truck Number
                    prompt: Please enter your TRUCK number
                - on_success: "{ truck_number_filled: true }"
                - on_error: "{ truck_number_filled: false }"
        - Policy:
            - Timeout:
                timeout_sec: "30"
        - Pre-Conditions List:
            - Pre-Condition:
                pre_condition: state.truck_number_filled == False
        - post_effects:
            - Post Effect:
                post_effect: state.truck_number_filled = True
    - Card:
        - card_id: acknowledge_receipt_v1
        - State List:
            - state:
                acknowledged: "False"
            - state:
                acknowledge_receipt_v1_timeout: "False"
        - delivery:
            - intent: acknowledge
            - interaction:
                interaction_type: acknowledge
        - Policy:
            - Timeout:
                timeout_sec: "10"
        - Pre-Conditions List:
            - Pre-Condition:
                pre_condition: state.truck_number_filled == True
            - Pre-Condition:
                pre_condition: state.acknowledged == False
        - post_effects:
            - Post Effect:
                post_effect: state.acknowledged = True',
  'PlanSpace:
  Actions:
    - Action:
        cost: 1
        name: invoke_card_collect_truck_num_v1
        pre_conditions:
          - state.truck_number_filled == False
        post_effects:
          - state.truck_number_filled = True
    - Action:
        cost: 1
        name: invoke_card_acknowledge_receipt_v1
        pre_conditions:
          - state.truck_number_filled == True
          - state.acknowledged == False
        post_effects:
          - state.acknowledged = True
  GoalState:
    expression: (state.acknowledged == True) or (state.flow_timeout == True)
  StartState:
    state:
      acknowledged: false
      flow_timeout: unknown
      truck_number_filled: false
      collect_truck_num_v1_timeout: false
      acknowledge_receipt_v1_timeout: false'
) ON CONFLICT (external_id) DO NOTHING;
