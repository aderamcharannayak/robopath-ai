# RoboPath AI
RoboPath AI is an interactive pathfinding visualizer that runs in the browser.  
It combines real road routing with classic algorithms so you can see how they behave on realistic maps.
## Features
- **Real road-based routing**
  - Uses OSRM (Open Source Routing Machine) under the hood.
  - Routes follow actual roads, not straight lines through buildings.
- **Algorithm comparison**
  - Compares **Dijkstra**, **A\***, and **BFS** on a constrained “road corridor”.
  - Shows:
    - Path length (meters)
    - Nodes explored
    - Compute time (ms)
- **Interactive map UI**
  - Click to set **start** and **destination** on a Leaflet map.
  - Add **obstacles** and see routes rerouted around them.
  - Robot simulation that “drives” along the best path.
- **Modern UI stack**
  - React + TypeScript + Vite
  - Tailwind CSS + shadcn-style components
  - React Query, React Router, Leaflet
## Getting Started
### Prerequisites
- **Node.js** (LTS recommended)
- **npm** (comes with Node) or another JS package manager
### Install and run
```bash
# install dependencies
npm install
# start dev server
npm run dev
