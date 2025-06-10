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
    
    # Create directed edges map with source tracking
    edges = {}
    
    # Process following relationships to create directed edges
    for user in raw_data['users']:
        for following in user['following']:
            edge_key = f"{user['user_id']}->{following['id']}"
            edges[edge_key] = {
                'source': user['user_id'],
                'target': following['id'],
                'source_type': 'following'  # Track that this came from a following relationship
            }
    
    # Process follower relationships to create directed edges (follower -> main user)
    for user in raw_data['users']:
        for follower in user['followers']:
            edge_key = f"{follower['id']}->{user['user_id']}"
            # Only add if this edge doesn't already exist from following relationships
            if edge_key not in edges:
                edges[edge_key] = {
                    'source': follower['id'],
                    'target': user['user_id'],
                    'source_type': 'follower'  # Track that this came from a follower relationship
                }
    
    print(f"Created {len(edges)} directed edges")
    
    # Create links directly from edges, determining type based on source and reciprocity
    links = []
    processed_pairs = set()  # Track processed pairs to avoid duplicates
    
    # For each edge, determine if it's mutual or one-way
    for edge_key, edge in edges.items():
        source_id = edge['source']
        target_id = edge['target']
        pair_key = tuple(sorted([source_id, target_id]))  # Canonical pair representation
        
        # Skip if we've already processed this pair
        if pair_key in processed_pairs:
            continue
            
        reverse_key = f"{target_id}->{source_id}"
        
        if reverse_key in edges:
            # Both directions exist - check if this should be mutual
            # Mutual = following edge + follower edge between same people
            edge_types = {edges[edge_key]['source_type'], edges[reverse_key]['source_type']}
            
            if edge_types == {'following', 'follower'}:
                # This is a true mutual relationship (following + follower)
                links.append({
                    'source': source_id,
                    'target': target_id,
                    'type': 'mutual',
                    'value': 1
                })
                processed_pairs.add(pair_key)
            else:
                # Both are same type, treat as separate one-way relationships
                # Add the current edge
                colin_id = "pfy59smofvvr5brx5cjt5sy2l"
                
                if edge['source_type'] == 'following':
                    if source_id == colin_id:
                        link_type = 'following'
                    elif target_id == colin_id:
                        link_type = 'follower'
                    else:
                        link_type = 'following'
                else:  # follower relationship
                    link_type = 'follower'
                
                links.append({
                    'source': source_id,
                    'target': target_id,
                    'type': link_type,
                    'value': 1
                })
                
                # Add the reverse edge if it hasn't been processed
                reverse_edge = edges[reverse_key]
                if reverse_edge['source_type'] == 'following':
                    if target_id == colin_id:
                        reverse_link_type = 'following'
                    elif source_id == colin_id:
                        reverse_link_type = 'follower'
                    else:
                        reverse_link_type = 'following'
                else:  # follower relationship
                    reverse_link_type = 'follower'
                
                links.append({
                    'source': target_id,
                    'target': source_id,
                    'type': reverse_link_type,
                    'value': 1
                })
                
                processed_pairs.add(pair_key)
        else:
            # This is a one-way relationship
            colin_id = "pfy59smofvvr5brx5cjt5sy2l"
            
            if edge['source_type'] == 'following':
                if source_id == colin_id:
                    link_type = 'following'
                elif target_id == colin_id:
                    link_type = 'follower'
                else:
                    link_type = 'following'
            else:  # follower relationship
                link_type = 'follower'
            
            links.append({
                'source': source_id,
                'target': target_id,
                'type': link_type,
                'value': 1
            })
            processed_pairs.add(pair_key)
    
    print(f"Created {len(links)} links:")
    mutual_count = sum(1 for link in links if link['type'] == 'mutual')
    following_count = sum(1 for link in links if link['type'] == 'following')
    follower_count = sum(1 for link in links if link['type'] == 'follower')
    print(f"  - {mutual_count} mutual relationships")
    print(f"  - {following_count} following relationships") 
    print(f"  - {follower_count} follower relationships")
    
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
            'mutual_connections': mutual_count,
            'following_connections': following_count,
            'follower_connections': follower_count,
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
    print("\nExample relationships:")
    colin_id = "pfy59smofvvr5brx5cjt5sy2l"
    
    # Show examples of each type
    mutual_links = [link for link in links if link['type'] == 'mutual'][:3]
    following_links = [link for link in links if link['type'] == 'following'][:2]  
    follower_links = [link for link in links if link['type'] == 'follower'][:2]
    
    print("  Mutual relationships:")
    for link in mutual_links:
        source_name = nodes[link['source']]['username']
        target_name = nodes[link['target']]['username']
        print(f"    {source_name} <-> {target_name} (mutual)")
    
    print("  Following relationships:")
    for link in following_links:
        source_name = nodes[link['source']]['username']
        target_name = nodes[link['target']]['username']
        print(f"    {source_name} -> {target_name} (following)")
        
    print("  Follower relationships:")
    for link in follower_links:
        source_name = nodes[link['source']]['username']
        target_name = nodes[link['target']]['username']
        print(f"    {source_name} -> {target_name} (follower)")

if __name__ == "__main__":
    process_network_graph() 