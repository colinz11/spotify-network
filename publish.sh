#!/bin/bash

# Spotify Network - GitHub Pages Publish Script
# This script helps prepare and publish the project to GitHub Pages

echo "🚀 Spotify Network - GitHub Pages Publisher"
echo "==========================================="

# Check if we're in the right directory
if [ ! -f "process_graph.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Step 2: Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Step 3: Build the React app
echo "🔧 Building React application..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
else
    echo "❌ Build failed"
    exit 1
fi

# Step 4: Deploy to GitHub Pages
echo "🚀 Deploying to GitHub Pages..."
npm run deploy
if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully!"
    echo ""
    echo "🌐 Your site will be available at:"
    echo "   https://colinzhu.github.io/spotify-network"
    echo ""
    echo "Note: It may take a few minutes for GitHub Pages to update."
else
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "🎉 All done! Your Spotify Network is now live on GitHub Pages!" 