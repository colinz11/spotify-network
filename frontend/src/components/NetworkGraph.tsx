import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode } from '../types/network';

interface NetworkGraphProps {
  data: GraphData;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hideLeafNodes, setHideLeafNodes] = useState<boolean>(false);
  const [showComponents, setShowComponents] = useState<boolean>(false);
  
  // Colin's user ID - the primary node
  const COLIN_USER_ID = "pfy59smofvvr5brx5cjt5sy2l";

    // Function to find all cliques (complete subgraphs) in the graph
  const findAllCliques = (nodes: any[], links: any[]): Map<number, Set<string>> => {
    // Build adjacency list (treating all edges as bidirectional)
    const adjacencyList = new Map<string, Set<string>>();
    nodes.forEach(node => adjacencyList.set(node.id, new Set()));

    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      adjacencyList.get(sourceId)?.add(targetId);
      adjacencyList.get(targetId)?.add(sourceId);
    });

    // Find all maximal cliques using Bron-Kerbosch algorithm (simplified)
    const cliques = new Map<number, Set<string>>();
    let cliqueId = 0;

    // Helper function to find cliques recursively
    const findCliques = (currentClique: Set<string>, candidates: Set<string>, excluded: Set<string>) => {
      if (candidates.size === 0 && excluded.size === 0) {
        // Found a maximal clique with 3+ nodes
        if (currentClique.size >= 3) {
          cliques.set(cliqueId++, new Set(currentClique));
        }
        return;
      }

      // Choose a pivot to reduce recursive calls
      const pivot = candidates.size > 0 ? Array.from(candidates)[0] : Array.from(excluded)[0];
      const pivotNeighbors = adjacencyList.get(pivot) || new Set();

      // For each candidate not connected to pivot
      Array.from(candidates).forEach(candidate => {
        if (pivotNeighbors.has(candidate)) return; // Skip if connected to pivot
        
        const candidateNeighbors = adjacencyList.get(candidate) || new Set();
        
        // New clique includes this candidate
        const newClique = new Set(currentClique);
        newClique.add(candidate);
        
        // New candidates are current candidates that are neighbors of this candidate
        const newCandidates = new Set<string>();
        candidates.forEach(c => {
          if (candidateNeighbors.has(c)) {
            newCandidates.add(c);
          }
        });
        
        // New excluded are current excluded that are neighbors of this candidate
        const newExcluded = new Set<string>();
        excluded.forEach(e => {
          if (candidateNeighbors.has(e)) {
            newExcluded.add(e);
          }
        });
        
        // Recurse
        findCliques(newClique, newCandidates, newExcluded);
        
        // Move candidate to excluded
        candidates.delete(candidate);
        excluded.add(candidate);
      });
    };

    // Start the algorithm with all nodes as candidates
    const allNodes = new Set(nodes.map(n => n.id));
    findCliques(new Set(), allNodes, new Set());

    return cliques;
  };

  // Function to get node clique assignments (multiple cliques per node possible)
  const getNodeCliqueMemberships = (nodes: any[], links: any[]): {
    nodeToLargestClique: Map<string, number>,
    nodeToAllCliques: Map<string, number[]>,
    allCliques: Map<number, Set<string>>
  } => {
    const allCliques = findAllCliques(nodes, links);
    const nodeToLargestClique = new Map<string, number>();
    const nodeToAllCliques = new Map<string, number[]>();
    
    // For each node, find all cliques it belongs to
    nodes.forEach(node => {
      const nodeCliques: number[] = [];
      allCliques.forEach((cliqueNodes, cliqueId) => {
        if (cliqueNodes.has(node.id)) {
          nodeCliques.push(cliqueId);
        }
      });
      
      if (nodeCliques.length > 0) {
        nodeToAllCliques.set(node.id, nodeCliques);
        
        // Find the largest clique this node belongs to
        let largestCliqueId = nodeCliques[0];
        let largestSize = allCliques.get(largestCliqueId)?.size || 0;
        
        nodeCliques.forEach(cliqueId => {
          const cliqueSize = allCliques.get(cliqueId)?.size || 0;
          if (cliqueSize > largestSize) {
            largestSize = cliqueSize;
            largestCliqueId = cliqueId;
          }
        });
        
        nodeToLargestClique.set(node.id, largestCliqueId);
      }
    });
    
    return { nodeToLargestClique, nodeToAllCliques, allCliques };
  };

  // Function to process network data and optionally hide leaf nodes
  const processNetworkData = (originalData: GraphData, hideLeaves: boolean): GraphData => {
    if (!hideLeaves) {
      return originalData;
    }

    // First, analyze bidirectional relationships to get accurate connection counts
    const edgeMap = new Map<string, {source: string, target: string}>();
    const bidirectionalPairs = new Set<string>();
    
    // Create edge map
    originalData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const edgeKey = `${sourceId}->${targetId}`;
      const reverseKey = `${targetId}->${sourceId}`;
      
      edgeMap.set(edgeKey, {source: sourceId, target: targetId});
      
      // Check if reverse edge exists
      if (edgeMap.has(reverseKey)) {
        // Mark this pair as bidirectional
        const pairKey = [sourceId, targetId].sort().join('<->');
        bidirectionalPairs.add(pairKey);
      }
    });

    // Count unique connections (treating bidirectional as one connection)
    const connectionCounts = new Map<string, Set<string>>();
    originalData.nodes.forEach(node => {
      connectionCounts.set(node.id, new Set());
    });

    const processedPairs = new Set<string>();
    originalData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const pairKey = [sourceId, targetId].sort().join('<->');
      
      // Skip if we've already processed this bidirectional pair
      if (bidirectionalPairs.has(pairKey) && processedPairs.has(pairKey)) {
        return;
      }
      
      // Add connection for both nodes
      connectionCounts.get(sourceId)?.add(targetId);
      connectionCounts.get(targetId)?.add(sourceId);
      
      if (bidirectionalPairs.has(pairKey)) {
        processedPairs.add(pairKey);
      }
    });

    // Identify leaf nodes (nodes with only 1 unique connection, excluding Colin)
    const leafNodes = originalData.nodes.filter(node => 
      node.id !== COLIN_USER_ID && (connectionCounts.get(node.id)?.size || 0) <= 1
    );

    if (leafNodes.length === 0) {
      return originalData;
    }

    // Create condensed node for leaf nodes
    const condensedNode: GraphNode = {
      id: 'CONDENSED_LEAVES',
      username: `${leafNodes.length} leaf connections`,
      follower_count: 0,
      following_count: 0
    };

    // Filter out leaf nodes and add condensed node
    const filteredNodes = originalData.nodes.filter(node => 
      node.id === COLIN_USER_ID || (connectionCounts.get(node.id)?.size || 0) > 1
    );
    const newNodes = [...filteredNodes, condensedNode];

    // Filter out links involving leaf nodes and add a link from Colin to condensed node
    const filteredLinks = originalData.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return !leafNodes.some(leaf => leaf.id === sourceId || leaf.id === targetId);
    });

    // Add link from Colin to condensed node if there are leaf nodes
    if (leafNodes.length > 0) {
      filteredLinks.push({
        source: COLIN_USER_ID,
        target: 'CONDENSED_LEAVES',
        value: 1
      });
    }

    return {
      nodes: newNodes,
      links: filteredLinks
    };
  };

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = window.innerWidth * 0.95;
    const height = window.innerHeight * 0.8;

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    // Process data based on hideLeafNodes setting
    let processedData = processNetworkData(data, hideLeafNodes);
    const originalLinks = processedData.links.map(d => ({ ...d }));
    const nodes = processedData.nodes.map(d => ({ ...d }));

    // Analyze edges to determine bidirectional vs unidirectional
    const edgeMap = new Map<string, {source: string, target: string}>();
    const bidirectionalPairs = new Set<string>();
    
    // Create edge map
    originalLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const edgeKey = `${sourceId}->${targetId}`;
      const reverseKey = `${targetId}->${sourceId}`;
      
      edgeMap.set(edgeKey, {source: sourceId, target: targetId});
      
      // Check if reverse edge exists
      if (edgeMap.has(reverseKey)) {
        // Mark this pair as bidirectional
        const pairKey = [sourceId, targetId].sort().join('<->');
        bidirectionalPairs.add(pairKey);
      }
    });

    // Create processed links with direction info
    const processedPairs = new Set<string>();
    const links: any[] = [];
    
    originalLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const pairKey = [sourceId, targetId].sort().join('<->');
      
      // Skip if we've already processed this bidirectional pair
      if (bidirectionalPairs.has(pairKey) && processedPairs.has(pairKey)) {
        return;
      }
      
      const isBidirectional = bidirectionalPairs.has(pairKey);
      
      links.push({
        source: sourceId,
        target: targetId,
        bidirectional: isBidirectional,
        value: 1
      });
      
             if (isBidirectional) {
         processedPairs.add(pairKey);
       }
     });

    // Debug output
    console.log(`Processed ${links.length} links`);

    // Get clique assignments for coloring (before creating nodes)
    const cliqueMemberships = showComponents ? getNodeCliqueMemberships(nodes, links) : { 
      nodeToLargestClique: new Map(), 
      nodeToAllCliques: new Map(), 
      allCliques: new Map() 
    };
    const { nodeToLargestClique, allCliques } = cliqueMemberships;
    const componentColors = [
      '#FF6B35', // Orange for Colin (will override)
      '#4ECDC4', // Teal 
      '#45B7D1', // Sky blue
      '#F9CA24', // Yellow
      '#F0932B', // Orange
      '#EB4D4B', // Red
      '#6C5CE7', // Purple
      '#00B894', // Mint green
      '#FDCB6E', // Light orange
      '#E17055', // Coral
      '#81ECEC', // Light teal
      '#A29BFE'  // Light purple
    ];

    // Find Colin and set his position at center
    const colinNode = nodes.find(n => n.id === COLIN_USER_ID);
    if (colinNode) {
      colinNode.fx = width / 2;
      colinNode.fy = height / 2;
    }

    // Create the force simulation with better spacing
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(150) // Increased distance for better spacing
        .strength(0.3)) // Reduced strength for looser connections
      .force("charge", d3.forceManyBody().strength(-400)) // Stronger repulsion for more spread
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30)) // Larger collision radius
      .force("radial", d3.forceRadial(200, width / 2, height / 2).strength(0.1)); // Radial force to spread nodes around Colin

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto");

    // Create zoom behavior
    const g = svg.append("g");
    
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create links with conditional styling for cliques
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => {
        if (!showComponents) return "#666";
        
        // Check if both source and target are in the same clique
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        const sourceComponent = nodeToLargestClique.get(sourceId);
        const targetComponent = nodeToLargestClique.get(targetId);
        
        if (sourceComponent !== undefined && sourceComponent === targetComponent) {
          // Both nodes are in the same clique - use clique color
          return componentColors[sourceComponent % componentColors.length];
        }
        
        return "#666"; // Default color for non-clique edges
      })
      .attr("stroke-opacity", 0.8)
      .attr("stroke-width", (d: any) => {
        if (!showComponents) return 2;
        
        // Check if both source and target are in the same clique
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        const sourceComponent = nodeToLargestClique.get(sourceId);
        const targetComponent = nodeToLargestClique.get(targetId);
        
        if (sourceComponent !== undefined && sourceComponent === targetComponent) {
          return 3; // Thicker lines for clique edges
        }
        
        return 2; // Default thickness
      });

    // Create node groups
    const nodeGroup = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", function(event: any, d: any) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", function(event: any, d: any) {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", function(event: any, d: any) {
          if (!event.active) simulation.alphaTarget(0);
          // Keep nodes fixed at their dragged position
          // Don't set fx and fy to null - this allows nodes to stay where dragged
        }) as any);

    // Add circles to node groups
    nodeGroup.append("circle")
      .attr("r", (d: any) => {
        // Make Colin larger and other nodes based on connections
        if (d.id === COLIN_USER_ID) return 20; // Colin is always large
        if (d.id === 'CONDENSED_LEAVES') return 15; // Condensed node is medium size
        return Math.max(6, Math.sqrt((d.follower_count || 0) + (d.following_count || 0)) * 1.5);
      })
      .attr("fill", (d: any) => {
        // Make Colin distinctive
        if (d.id === COLIN_USER_ID) return "#FF6B35"; // Orange for Colin
        if (d.id === 'CONDENSED_LEAVES') return "#9E9E9E"; // Gray for condensed node
        
        // Color by clique if cliques are shown
        if (showComponents) {
          const componentId = nodeToLargestClique.get(d.id);
          if (componentId !== undefined) {
            return componentColors[componentId % componentColors.length];
          }
        }
        
        // Default coloring based on connection count
        const total = (d.follower_count || 0) + (d.following_count || 0);
        if (total > 100) return "#1DB954"; // Spotify green for popular users
        if (total > 50) return "#1ED760";  // Lighter green
        if (total > 20) return "#9BF0A3";  // Even lighter
        return "#C8F7C5";                  // Very light green for new users
      })
      .attr("stroke", (d: any) => {
        if (d.id === COLIN_USER_ID) return "#FF4500";
        if (d.id === 'CONDENSED_LEAVES') return "#757575";
        return "#fff";
      })
      .attr("stroke-width", (d: any) => {
        if (d.id === COLIN_USER_ID) return 4;
        if (d.id === 'CONDENSED_LEAVES') return 3;
        return 2;
      })
      .style("cursor", "pointer");

    // Add labels to node groups
    nodeGroup.append("text")
      .text((d: any) => d.username || d.id)
      .attr("dx", (d: any) => d.id === COLIN_USER_ID ? 25 : 15)
      .attr("dy", 5)
      .style("font-size", (d: any) => d.id === COLIN_USER_ID ? "16px" : "12px")
      .style("font-family", "Arial, sans-serif")
      .style("fill", (d: any) => d.id === COLIN_USER_ID ? "#FF4500" : "#333")
      .style("font-weight", (d: any) => d.id === COLIN_USER_ID ? "bold" : "normal")
      .style("pointer-events", "none")
      .style("opacity", 1); // Show all labels by default

    // Add hover and click interactions
    nodeGroup
      .on("mouseenter", function(event: any, d: any) {
        if (showComponents) {
          // In clique mode: highlight only the biggest clique this node belongs to
          const hoveredNodeLargestClique = nodeToLargestClique.get(d.id);
          
          if (hoveredNodeLargestClique !== undefined) {
            // Get the clique color
            const cliqueColor = componentColors[hoveredNodeLargestClique % componentColors.length];
            
            // Get all nodes in the largest clique
            const cliqueNodes = allCliques.get(hoveredNodeLargestClique);
            
            if (cliqueNodes) {
              // Highlight nodes in the clique with the clique color, dim others
              nodeGroup.select("circle")
                .style("opacity", (n: any) => cliqueNodes.has(n.id) ? 1 : 0.3)
                .style("fill", (n: any) => {
                  if (n.id === COLIN_USER_ID) return "#FF6B35"; // Keep Colin's color
                  if (n.id === 'CONDENSED_LEAVES') return "#9E9E9E"; // Keep condensed color
                  return cliqueNodes.has(n.id) ? cliqueColor : null; // Use clique color for clique members
                });
              
              // Highlight edges within the clique with the same color
              link
                .style("stroke-opacity", (l: any) => {
                  const sourceId = l.source.id || l.source;
                  const targetId = l.target.id || l.target;
                  
                  // Check if both nodes are in the hovered clique
                  if (cliqueNodes.has(sourceId) && cliqueNodes.has(targetId)) {
                    return 1;
                  }
                  return 0.1;
                })
                .style("stroke", (l: any) => {
                  const sourceId = l.source.id || l.source;
                  const targetId = l.target.id || l.target;
                  
                  // Use clique color for edges within the clique
                  if (cliqueNodes.has(sourceId) && cliqueNodes.has(targetId)) {
                    return cliqueColor;
                  }
                  return null; // Keep original color
                });
            }
          } else {
            // Node not in any clique - just highlight its direct connections
            link.style("stroke-opacity", (l: any) => 
              l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
            );
          }
        } else {
          // Default mode: highlight connected links
          link.style("stroke-opacity", (l: any) => 
            l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
          );
        }
        
        // Show label
        d3.select(this).select("text").style("opacity", 1);
        
        // Show tooltip
        showTooltip(event, d);
      })
      .on("mouseleave", function() {
        // Reset all styling
        nodeGroup.select("circle")
          .style("opacity", 1)
          .style("fill", null); // Reset to original fill color
        link
          .style("stroke-opacity", 0.8)
          .style("stroke", null); // Reset to original stroke color
        
        // Hide tooltip
        hideTooltip();
      })
      .on("click", function(event: any, d: any) {
        event.stopPropagation();
        // Clicking nodes now does nothing - components are shown via toggle
      });

    // Update positions on each tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Tooltip functions
    function showTooltip(event: any, d: any) {
      const tooltip = d3.select("body").selectAll(".tooltip").data([0]);
      
      const tooltipEnter = tooltip.enter()
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .style("opacity", 0);

      let tooltipContent;
      
      if (d.id === COLIN_USER_ID) {
        tooltipContent = `
          <strong>${d.username || d.id}</strong><br/>
          Followers: ${d.follower_count || 0}<br/>
          Following: ${d.following_count || 0}<br/>
          <em>Primary Node - Center of Network</em>
        `;
      } else if (d.id === 'CONDENSED_LEAVES') {
        tooltipContent = `
          <strong>${d.username}</strong><br/>
          <em>Represents users with only one connection</em><br/>
          <em>Toggle checkbox to see individual nodes</em>
        `;
      } else {
        tooltipContent = `
          <strong>${d.username || d.id}</strong><br/>
          Followers: ${d.follower_count || 0}<br/>
          Following: ${d.following_count || 0}<br/>
          <em>Connected to network</em>
        `;
      }
        
      tooltip.merge(tooltipEnter as any)
        .html(tooltipContent)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .style("opacity", 1);
    }

    function hideTooltip() {
      d3.select("body").selectAll(".tooltip").style("opacity", 0);
    }

    // Cleanup function
    return () => {
      simulation.stop();
      d3.select("body").selectAll(".tooltip").remove();
    };

  }, [data, hideLeafNodes, showComponents, getNodeCliqueMemberships]);

  return (
    <div className="network-container" style={{ width: '100%', height: '100%' }}>
      <div className="controls" style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <strong>Controls:</strong>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hideLeafNodes}
              onChange={(e) => setHideLeafNodes(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Hide leaf nodes (single connections)</span>
          </label>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showComponents}
              onChange={(e) => setShowComponents(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Show cliques (fully connected groups)</span>
          </label>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>Legend:</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '15px', 
              height: '15px', 
              borderRadius: '50%',
              backgroundColor: '#FF6B35' 
            }}></div>
            <span>Colin (Primary Node)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '20px', 
              height: '2px', 
              backgroundColor: '#666' 
            }}></div>
            <span>Connection</span>
          </div>
          {hideLeafNodes && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%',
                backgroundColor: '#9E9E9E',
                border: '2px solid #757575'
              }}></div>
              <span>Condensed leaf nodes</span>
            </div>
          )}
        </div>
        <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
          • Hover over nodes to highlight connections<br/>
          • Drag nodes to reposition<br/>
          • Scroll to zoom, drag to pan
        </div>
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default NetworkGraph; 