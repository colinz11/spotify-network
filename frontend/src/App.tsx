import React, { useState, useEffect } from 'react';
import NetworkGraph from './components/NetworkGraph';
import { GraphData } from './types/network';
import './App.css';

function App() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/graph.json')
      .then(response => {
        if (!response.ok) {
          throw new Error("Could not fetch graph.json. Please run 'python process_graph.py' to generate the processed graph data.");
        }
        return response.json();
      })
      .then((graphData: GraphData) => {
        // Graph data is already processed by Python - just use it directly
        setData(graphData);
        setLoading(false);
      })
      .catch((error: Error) => {
        console.error("Error loading graph data:", error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Spotify Friend Network</h1>
        {data && (
          <div className="stats">
            <span>{data.nodes.length} users</span>
            <span>{data.links.length} connections</span>
          </div>
        )}
      </header>
      <main>
        {loading && <p>Loading network data...</p>}
        {error && <p className="error">Error: {error}</p>}
        {data && <NetworkGraph data={data} />}
        {!loading && !error && !data && <p>No data loaded. Make sure to run the scraper first.</p>}
      </main>
    </div>
  );
}

export default App; 