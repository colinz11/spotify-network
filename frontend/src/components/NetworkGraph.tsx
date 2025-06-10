import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '../types/network';

interface NetworkGraphProps {
  data: GraphData;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hideLeafNodes, setHideLeafNodes] = useState<boolean>(false);
  
  // Colin's user ID - the primary node
  const COLIN_USER_ID = "pfy59smofvvr5brx5cjt5sy2l";

  // Function to process network data and optionally hide leaf nodes
  const processNetworkData = (originalData: GraphData, hideLeaves: boolean): GraphData => {
    if (!hideLeaves) {
      return originalData;
    }

    // Count connections for each node
    const connectionCounts = new Map<string, number>();
    originalData.nodes.forEach(node => {
      connectionCounts.set(node.id, 0);
    });

    originalData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      connectionCounts.set(sourceId, (connectionCounts.get(sourceId) || 0) + 1);
      connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1);
    });

    // Identify leaf nodes (nodes with only 1 connection, excluding Colin)
    const leafNodes = originalData.nodes.filter(node => 
      node.id !== COLIN_USER_ID && (connectionCounts.get(node.id) || 0) <= 1
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
      node.id === COLIN_USER_ID || (connectionCounts.get(node.id) || 0) > 1
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
        type: 'following',
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
    const links = processedData.links.map(d => ({ ...d }));
    const nodes = processedData.nodes.map(d => ({ ...d }));

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

    // Define color scheme for different relationship types - more distinct colors
    const colorScale: Record<string, string> = {
      'follower': '#E53E3E',      // Bright red - someone follows the target
      'following': '#38A169',     // Forest green - source follows someone  
      'mutual': '#3182CE'         // Strong blue - mutual following
    };

    // No arrow markers needed - using colored lines only

    // Create links - no arrows, just colored lines
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => colorScale[d.type])
      .attr("stroke-opacity", 0.8)
      .attr("stroke-width", (d: any) => d.type === 'mutual' ? 5 : 3); // Thicker lines for better color visibility

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
          d.fx = null;
          d.fy = null;
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
    const labels = nodeGroup.append("text")
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
        // Highlight connected links
        link.style("stroke-opacity", (l: any) => 
          l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
        );
        
        // Show label
        d3.select(this).select("text").style("opacity", 1);
        
        // Show tooltip
        showTooltip(event, d);
      })
      .on("mouseleave", function() {
        // Reset link opacity
        link.style("stroke-opacity", 0.8);
        
        // Hide tooltip
        hideTooltip();
      })
      .on("click", function(event: any, d: any) {
        event.stopPropagation();
        setSelectedNode(selectedNode?.id === d.id ? null : d);
        
        // Toggle label highlighting when clicking a node
        if (selectedNode?.id === d.id) {
          labels.style("opacity", 1); // Show all labels normally
        } else {
          labels.style("opacity", (node: any) => node.id === d.id ? 1 : 0.4); // Dim other labels
        }
      });

    // Click anywhere to deselect
    svg.on("click", () => {
      setSelectedNode(null);
      labels.style("opacity", 1); // Restore all labels to full opacity
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
          <em>Connected to Colin</em>
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

  }, [data, selectedNode, hideLeafNodes]);

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
              height: '4px', 
              backgroundColor: '#E53E3E' 
            }}></div>
            <span>Follower relationship</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '20px', 
              height: '4px', 
              backgroundColor: '#38A169' 
            }}></div>
            <span>Following relationship</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '20px', 
              height: '4px', 
              backgroundColor: '#3182CE' 
            }}></div>
            <span>Mutual following</span>
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
          • Colin is fixed at center (orange node)<br/>
          • All names are shown by default<br/>
          • Hover over nodes to highlight connections<br/>
          • Click nodes to pin/unpin labels<br/>
          • Drag nodes to reposition<br/>
          • Scroll to zoom, drag to pan
        </div>
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default NetworkGraph; 