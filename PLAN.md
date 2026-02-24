# Transit Monorepo Implementation Plan

## Overview
This document outlines the implementation plan for the transit monorepo, including API organization, UI configuration, and OSM to diagrammatic maps processing.

## Monorepo Structure

```
transit-monorepo/
├── apps/
│   ├── train-diagram/
│   └── travel-planner/
├── packages/
│   ├── api/
│   │   ├── core/              # Shared tRPC setup
│   │   ├── sncf/              # SNCF-specific API
│   │   ├── data-gouv/         # Data.gouv-specific API
│   │   └── osm/               # OpenStreetMap API
│   ├── ui/                    # Shared UI with Tailwind
│   ├── types/                 # Shared types
│   ├── config/                # Shared configs
│   └── osm-processor/         # OSM → diagrammatic maps
├── server/                    # tRPC backend
└── tailwind.config.js         # Global Tailwind config
```

## API Package Organization

### Recommended Approach: Separate packages per API
- `packages/api/sncf` - SNCF-specific tRPC routers
- `packages/api/data-gouv` - Data.gouv API integration
- `packages/api/osm` - OpenStreetMap handlers
- `packages/api/core` - Shared tRPC infrastructure

### Benefits:
1. Clear separation of concerns
2. Independent versioning if needed
3. Easier to maintain different API clients
4. Better type isolation
5. Can share common tRPC setup via core package

## Vite + Tailwind Configuration

### Current Implementation:

1. **App-Specific Tailwind Setup:**
   - Tailwind configured directly in each app's Vite config
   - Using `@tailwindcss/vite` plugin for direct integration
   - CSS imports handled through Vite's native CSS support

2. **UI Package Structure:**
   - UI components export individual files
   - Styles are imported directly in consuming apps
   - No library mode build needed - using direct source imports

3. **App Configuration:**
   ```typescript
   // apps/*/vite.config.ts
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react-swc'
   import tailwindcss from '@tailwindcss/vite'
   
   export default defineConfig({
     plugins: [
       react(),
       tailwindcss(),
     ],
   })
   ```

### Benefits of Current Approach:
1. Simpler configuration - no global Tailwind setup needed
2. Direct source imports work well with Vite's optimizations
3. Easier to maintain and debug
4. Better compatibility with TanStack Router and other tools

## OSM to Diagrammatic Maps

### Implementation Plan:

1. **OSM Processor Package (`packages/osm-processor`):**
   - Input: OSM data (GeoJSON/Overpass)
   - Processing pipeline:
     1. Filter relevant features (train lines, stations)
     2. Simplify geometries
     3. Apply diagrammatic rules:
        - Straighten curves
        - Standardize angles (45° increments)
        - Consistent spacing
        - Color coding by line
     4. Output: Simplified SVG/Canvas commands

2. **Key Components:**
   ```typescript
   // Example processor interface
   interface DiagrammaticMapOptions {
     angleSnap: number
     minDistance: number
     lineColors: Record<string, string>
   }
   
   function processOSMToDiagram(osmData: GeoJSON, options: DiagrammaticMapOptions): DiagramMap {
     // Implementation steps:
     // 1. Extract relevant features
     // 2. Apply simplification
     // 3. Apply diagrammatic rules
     // 4. Return structured diagram data
   }
   ```

3. **Visualization Approach:**
   - Use Canvas API for rendering
   - Implement zoom/pan interactions
   - Add station labels with collision avoidance
   - Support for interactive elements

## Revised Implementation Phases

### Phase 1: Core Setup
1. Initialize TurboRepo with separate API packages
2. Configure global Tailwind setup
3. Create UI package with Vite library mode
4. Set up tRPC core infrastructure

### Phase 2: API Development
1. Implement SNCF API package
2. Develop Data.gouv integration
3. Create OSM API handlers
4. Build shared tRPC routers

### Phase 3: OSM Processor
1. Research diagrammatic map algorithms
2. Implement simplification pipeline
3. Create visualization components
4. Integrate with train diagram app

### Phase 4: App Development
1. Build train diagram app with processed maps
2. Develop travel planner with direction APIs
3. Create shared UI components
4. Implement responsive designs

## Key Technical Decisions

1. **API Organization:**
   - Separate packages for better maintainability
   - Shared tRPC core for consistency
   - Each API can have its own data models

2. **UI Configuration:**
   - Direct source imports from UI package
   - App-specific Tailwind configuration
   - Vite-native CSS handling

3. **Diagrammatic Maps:**
   - Processing pipeline in separate package
   - Canvas-based rendering
   - Configurable simplification rules

4. **Performance Considerations:**
   - Worker threads for heavy processing
   - Memoization of processed maps
   - Efficient data structures for geometry

## Questions for Clarification:

1. Should the diagrammatic map processor handle real-time updates or be pre-processing only?
2. Do you have specific visual style references for the train diagrams?
3. Should we prioritize accuracy or visual clarity in the diagrammatic transformation?
4. Any preferences for the level of interactivity in the diagram visualization?