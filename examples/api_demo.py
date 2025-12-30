#!/usr/bin/env python3
"""
Protocol Builder API Demo Script

This script demonstrates how to interact with the Protocol Builder REST API.
Make sure the API server is running at http://localhost:3001

Usage:
    pip install requests
    python api_demo.py
"""

import requests
import json
from typing import Optional

# API Base URL
BASE_URL = "http://localhost:3001"


def print_response(title: str, response: requests.Response):
    """Helper to print API responses nicely."""
    print(f"\n{'='*60}")
    print(f"📌 {title}")
    print(f"{'='*60}")
    print(f"Status: {response.status_code}")
    
    content_type = response.headers.get('Content-Type', '')
    if 'application/json' in content_type:
        try:
            print(f"Response:\n{json.dumps(response.json(), indent=2)}")
        except:
            print(f"Response: {response.text[:500]}")
    elif 'text/yaml' in content_type or 'text/plain' in content_type:
        print(f"Response:\n{response.text[:1000]}")
    else:
        print(f"Response: {response.text[:500]}")


# =============================================================================
# Health Check
# =============================================================================

def check_health():
    """GET /health - Check API and database status."""
    response = requests.get(f"{BASE_URL}/health")
    print_response("Health Check", response)
    return response.json()


# =============================================================================
# Flows CRUD Operations
# =============================================================================

def list_flows():
    """GET /api/flows - List all flows."""
    response = requests.get(f"{BASE_URL}/api/flows")
    print_response("List All Flows", response)
    return response.json()


def get_flow_by_id(flow_id: int):
    """GET /api/flows/:id - Get flow by ID."""
    response = requests.get(f"{BASE_URL}/api/flows/{flow_id}")
    print_response(f"Get Flow by ID ({flow_id})", response)
    return response.json() if response.status_code == 200 else None


def get_flow_by_external_id(external_id: str):
    """GET /api/flows/external/:externalId - Get flow by external ID."""
    response = requests.get(f"{BASE_URL}/api/flows/external/{external_id}")
    print_response(f"Get Flow by External ID ({external_id})", response)
    return response.json() if response.status_code == 200 else None


def create_flow(name: str, external_id: Optional[str] = None, 
                flow_yaml: Optional[str] = None, plan_yaml: Optional[str] = None):
    """POST /api/flows - Create a new flow."""
    payload = {"name": name}
    if external_id:
        payload["external_id"] = external_id
    if flow_yaml:
        payload["flow_yaml"] = flow_yaml
    if plan_yaml:
        payload["plan_yaml"] = plan_yaml
    
    response = requests.post(
        f"{BASE_URL}/api/flows",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    print_response(f"Create Flow ({name})", response)
    return response.json() if response.status_code == 201 else None


def update_flow(flow_id: int, **updates):
    """PUT /api/flows/:id - Update a flow."""
    response = requests.put(
        f"{BASE_URL}/api/flows/{flow_id}",
        json=updates,
        headers={"Content-Type": "application/json"}
    )
    print_response(f"Update Flow ({flow_id})", response)
    return response.json() if response.status_code == 200 else None


def delete_flow(flow_id: int):
    """DELETE /api/flows/:id - Delete a flow."""
    response = requests.delete(f"{BASE_URL}/api/flows/{flow_id}")
    print_response(f"Delete Flow ({flow_id})", response)
    return response.status_code == 204


# =============================================================================
# Raw YAML Endpoints
# =============================================================================

def get_flow_yaml(flow_id: int):
    """GET /api/flows/:id/flow.yaml - Get raw flow YAML."""
    response = requests.get(f"{BASE_URL}/api/flows/{flow_id}/flow.yaml")
    print_response(f"Get Raw Flow YAML ({flow_id})", response)
    return response.text if response.status_code == 200 else None


def get_planspace_yaml(flow_id: int):
    """GET /api/flows/:id/planspace.yaml - Get raw PlanSpace YAML."""
    response = requests.get(f"{BASE_URL}/api/flows/{flow_id}/planspace.yaml")
    print_response(f"Get Raw PlanSpace YAML ({flow_id})", response)
    return response.text if response.status_code == 200 else None


def get_flow_yaml_by_external_id(external_id: str):
    """GET /api/flows/external/:externalId/flow.yaml - Get raw flow YAML by external ID."""
    response = requests.get(f"{BASE_URL}/api/flows/external/{external_id}/flow.yaml")
    print_response(f"Get Raw Flow YAML by External ID ({external_id})", response)
    return response.text if response.status_code == 200 else None


def get_planspace_yaml_by_external_id(external_id: str):
    """GET /api/flows/external/:externalId/planspace.yaml - Get raw PlanSpace YAML by external ID."""
    response = requests.get(f"{BASE_URL}/api/flows/external/{external_id}/planspace.yaml")
    print_response(f"Get Raw PlanSpace YAML by External ID ({external_id})", response)
    return response.text if response.status_code == 200 else None


# =============================================================================
# AI Chat Endpoints
# =============================================================================

def check_ai_status():
    """GET /api/ai/status - Check if AI is configured."""
    response = requests.get(f"{BASE_URL}/api/ai/status")
    print_response("AI Status", response)
    return response.json()


def ai_chat(workspace: str, message: str, history: list = None, current_flow_yaml: str = None):
    """POST /api/ai/chat - Chat with AI assistant (non-streaming)."""
    payload = {
        "workspace": workspace,
        "message": message,
        "history": history or []
    }
    if current_flow_yaml:
        payload["currentFlowYaml"] = current_flow_yaml
    
    response = requests.post(
        f"{BASE_URL}/api/ai/chat",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    print_response(f"AI Chat ({workspace})", response)
    return response.json() if response.status_code == 200 else None


# =============================================================================
# Demo Script
# =============================================================================

def main():
    print("\n" + "🚀 "*20)
    print("    PROTOCOL BUILDER API DEMO")
    print("🚀 "*20)
    
    # 1. Health Check
    print("\n\n📍 STEP 1: Health Check")
    health = check_health()
    if health.get("status") != "healthy":
        print("⚠️  Warning: API may not be fully operational")
    
    # 2. List existing flows
    print("\n\n📍 STEP 2: List Existing Flows")
    flows = list_flows()
    
    # 3. Get flow by external ID (using seeded data)
    print("\n\n📍 STEP 3: Get Flow by External ID")
    protocol_flow = get_flow_by_external_id("111")  # Protocol: Base Case Truck
    
    # 4. Get raw YAML
    if protocol_flow:
        print("\n\n📍 STEP 4: Get Raw YAML Content")
        get_flow_yaml(protocol_flow["id"])
        get_planspace_yaml(protocol_flow["id"])
    
    # 5. Create a new flow
    print("\n\n📍 STEP 5: Create New Flow")
    sample_flow_yaml = """diagram:
  Protocol:
    - Fill Data:
        - block_type: Action
        - data_field: license_plate
    - Access Decision:
        access: Granted"""
    
    new_flow = create_flow(
        name="Demo Flow - License Plate Check",
        external_id="demo-lp-check",
        flow_yaml=sample_flow_yaml
    )
    
    # 6. Update the flow
    if new_flow:
        print("\n\n📍 STEP 6: Update Flow")
        updated = update_flow(
            new_flow["id"],
            name="Demo Flow - License Plate Check (Updated)"
        )
    
    # 7. Check AI status
    print("\n\n📍 STEP 7: Check AI Assistant Status")
    ai_status = check_ai_status()
    
    # 8. AI Chat (if configured)
    if ai_status.get("configured"):
        print("\n\n📍 STEP 8: AI Chat Demo")
        ai_response = ai_chat(
            workspace="protocols",
            message="What blocks are available in the protocols workspace?"
        )
    else:
        print("\n\n📍 STEP 8: AI Chat Demo - SKIPPED (AI not configured)")
    
    # 9. Delete the demo flow
    if new_flow:
        print("\n\n📍 STEP 9: Delete Demo Flow")
        delete_flow(new_flow["id"])
    
    # Summary
    print("\n\n" + "✅ "*20)
    print("    DEMO COMPLETE!")
    print("✅ "*20)
    print("""
API Endpoints Summary:
  Health:
    GET  /health                              - Check API health
    
  Flows (JSON):
    GET  /api/flows                           - List all flows
    POST /api/flows                           - Create new flow
    GET  /api/flows/:id                       - Get flow by ID
    GET  /api/flows/external/:externalId      - Get flow by external ID
    PUT  /api/flows/:id                       - Update flow
    DELETE /api/flows/:id                     - Delete flow
    
  Flows (Raw YAML):
    GET  /api/flows/:id/flow.yaml             - Get raw flow YAML
    GET  /api/flows/:id/planspace.yaml        - Get raw PlanSpace YAML
    GET  /api/flows/external/:externalId/flow.yaml
    GET  /api/flows/external/:externalId/planspace.yaml
    
  AI Assistant:
    GET  /api/ai/status                       - Check AI configuration
    POST /api/ai/chat                         - Chat (non-streaming)
    POST /api/ai/chat/stream                  - Chat (streaming SSE)
    
  Documentation:
    GET  /api-docs                            - Swagger UI
    GET  /openapi.json                        - OpenAPI spec
""")


if __name__ == "__main__":
    main()
