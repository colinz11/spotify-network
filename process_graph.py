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
    
    # Add all main users first
    for user in raw_data['users']:
        potential_nodes[user['user_id']] = {
            'id': user['user_id'],
            'username': user['username'],
            'follower_count': user['follower_count'],
            'following_count': user['following_count']
        }
    
    # Add referenced users (from followers/following lists)
    for user in raw_data['users']:
        # Add followers
        for follower in user['followers']:
            if follower['id'] not in potential_nodes:
                potential_nodes[follower['id']] = {
                    'id': follower['id'],
                    'username': follower['name'],
                    'follower_count': 0,
                    'following_count': 0
                }
        
        # Add following
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
    
    # Process following relationships to create edges
    for user in raw_data['users']:
        for following in user['following']:
            edges.add((user['user_id'], following['id']))
    
    # Process follower relationships to create edges (follower -> main user)
    for user in raw_data['users']:
        for follower in user['followers']:
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
    
    # Find nodes that are connected (appear in at least one link)
    connected_node_ids = set()
    for link in links:
        connected_node_ids.add(link['source'])
        connected_node_ids.add(link['target'])
    
    # Filter to only include connected nodes
    nodes = {node_id: potential_nodes[node_id] for node_id in connected_node_ids}
    
    print(f"Filtered to {len(nodes)} connected nodes (removed {len(potential_nodes) - len(nodes)} isolated nodes)")
    
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