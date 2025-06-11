#!/usr/bin/env python3
"""
Process Spotify network data into a clean graph structure for visualization.
Reads data/network.json and outputs frontend/public/graph.json
"""

import json
import sys
from pathlib import Path

def process_network_graph():
    # Read the network data
    network_file = Path("data/network.json")
    if not network_file.exists():
        print(f"Error: {network_file} not found")
        sys.exit(1)
    
    with open(network_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    print(f"Processing {len(raw_data['users'])} users...")
    
    # Create potential nodes map (we'll filter later)
    potential_nodes = {}
    
    # First pass: identify high-activity users to filter out
    filtered_user_ids = set()
    filtered_count = 0
    
    for user in raw_data['users']:
        # Identify users with 900+ followers or following
        if user['follower_count'] >= 900 or user['following_count'] >= 900:
            filtered_user_ids.add(user['user_id'])
            filtered_count += 1
    
    print(f"Identified {filtered_count} high-activity users to filter out")
    
    # Add all main users (excluding high-activity users)
    for user in raw_data['users']:
        if user['user_id'] not in filtered_user_ids:
            potential_nodes[user['user_id']] = {
                'id': user['user_id'],
                'username': user['username'],
                'follower_count': user['follower_count'],
                'following_count': user['following_count']
            }
    
    # Add referenced users (from followers/following lists)
    # Only add if the main user wasn't filtered out
    for user in raw_data['users']:
        # Skip if this user was filtered out
        if user['user_id'] not in potential_nodes:
            continue
            
        # Add followers (we don't have their full data, so we assume they're under threshold)
        for follower in user['followers']:
            if follower['id'] not in potential_nodes:
                potential_nodes[follower['id']] = {
                    'id': follower['id'],
                    'username': follower['name'],
                    'follower_count': 0,
                    'following_count': 0
                }
        
        # Add following (we don't have their full data, so we assume they're under threshold)
        for following in user['following']:
            if following['id'] not in potential_nodes:
                potential_nodes[following['id']] = {
                    'id': following['id'],
                    'username': following['name'],
                    'follower_count': 0,
                    'following_count': 0
                }
    
    print(f"Created {len(potential_nodes)} potential nodes")
    
    # Create simple edges without type tracking
    edges = set()  # Use set to avoid duplicates
    
    # Process following relationships to create edges (skip filtered users)
    for user in raw_data['users']:
        # Skip if this user was filtered out
        if user['user_id'] not in potential_nodes:
            continue
            
        for following in user['following']:
            # Only create edge if both nodes exist in our filtered set
            if following['id'] in potential_nodes:
                edges.add((user['user_id'], following['id']))
    
    # Process follower relationships to create edges (follower -> main user)
    for user in raw_data['users']:
        # Skip if this user was filtered out
        if user['user_id'] not in potential_nodes:
            continue
            
        for follower in user['followers']:
            # Only create edge if both nodes exist in our filtered set
            if follower['id'] in potential_nodes:
                edges.add((follower['id'], user['user_id']))
    
    print(f"Created {len(edges)} unique edges")
    
    # Convert edges to simple links
    links = []
    for source_id, target_id in edges:
        links.append({
            'source': source_id,
            'target': target_id,
            'value': 1
        })
    
    print(f"Created {len(links)} links")
    
    # Build a connection map to identify nodes only connected to filtered users
    node_connections = {}
    for link in links:
        source_id = link['source']
        target_id = link['target']
        
        if source_id not in node_connections:
            node_connections[source_id] = set()
        if target_id not in node_connections:
            node_connections[target_id] = set()
            
        node_connections[source_id].add(target_id)
        node_connections[target_id].add(source_id)
    
    # Find nodes that are only connected to filtered users
    nodes_only_connected_to_filtered = set()
    for node_id, connections in node_connections.items():
        # Skip if this is a filtered user
        if node_id in filtered_user_ids:
            continue
            
        # Check if ALL connections are to filtered users
        if connections and all(conn_id in filtered_user_ids for conn_id in connections):
            nodes_only_connected_to_filtered.add(node_id)
    
    print(f"Found {len(nodes_only_connected_to_filtered)} nodes only connected to filtered users")
    
    # Remove links involving nodes that are only connected to filtered users
    filtered_links = []
    for link in links:
        source_id = link['source']
        target_id = link['target']
        
        # Skip links involving filtered users or nodes only connected to filtered users
        if (source_id in filtered_user_ids or 
            target_id in filtered_user_ids or
            source_id in nodes_only_connected_to_filtered or
            target_id in nodes_only_connected_to_filtered):
            continue
            
        filtered_links.append(link)
    
    print(f"Reduced to {len(filtered_links)} links after filtering")
    
    # Find nodes that are connected (appear in at least one filtered link)
    connected_node_ids = set()
    for link in filtered_links:
        connected_node_ids.add(link['source'])
        connected_node_ids.add(link['target'])
    
    # Filter to only include connected nodes
    nodes = {node_id: potential_nodes[node_id] for node_id in connected_node_ids if node_id in potential_nodes}
    
    total_filtered = filtered_count + len(nodes_only_connected_to_filtered)
    print(f"Final network: {len(nodes)} nodes and {len(filtered_links)} links")
    print(f"Total filtered: {total_filtered} users ({filtered_count} high-activity + {len(nodes_only_connected_to_filtered)} only-connected-to-filtered)")
    
    # Update links to use the filtered set
    links = filtered_links
    
    # Create final graph structure
    graph_data = {
        'nodes': list(nodes.values()),
        'links': links,
        'metadata': {
            'total_users': len(nodes),
            'total_connections': len(links),
            'processed_from': 'data/network.json'
        }
    }
    
    # Ensure output directory exists
    output_dir = Path("frontend/public")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Write processed graph data
    output_file = output_dir / "graph.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, indent=2, ensure_ascii=False)
    
    print(f"Graph data written to {output_file}")
    
    # Print some examples for verification
    print("\nExample connections:")
    example_links = links[:5]
    
    for link in example_links:
        source_name = nodes[link['source']]['username']
        target_name = nodes[link['target']]['username']
        print(f"  {source_name} -> {target_name}")

if __name__ == "__main__":
    process_network_graph() 