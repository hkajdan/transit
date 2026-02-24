# Transit Monorepo Implementation Plan

## Overview
This document outlines the implementation plan for the transit monorepo, including API organization, UI configuration, and OSM to diagrammatic maps processing. The backend has been migrated from tRPC to Convex for improved scalability and real-time capabilities.

## Monorepo Structure

```
transit-monorepo/
├── apps/
│   ├── diagram/              # Train diagram application
│   └── travel-planner/        # Travel planning application (future)
├── packages/
│   ├── api/
│   │   ├── convex/            # Convex backend (self-hosted)
│   │   ├── sncf/              # SNCF API integration
│   │   ├── data-gouv/         # Data.gouv API integration
│   │   ├── osm/               # OpenStreetMap API integration
│   │   └── google-maps/      # Google Maps API integration
│   ├── ui/                    # Shared UI components with Tailwind
│   ├── types/                 # Shared TypeScript types
│   ├── config/                # Shared configurations
│   └── osm-processor/         # OSM → diagrammatic maps processor
├── convex/                    # Convex deployment configuration
└── tailwind.config.js         # Global Tailwind config
```

## API Package Organization

### Backend Architecture: Convex as Primary Backend
- `packages/api/convex` - Core Convex functions and schema
- `packages/api/sncf` - SNCF-specific Convex integrations
- `packages/api/data-gouv` - Data.gouv API Convex wrappers
- `packages/api/osm` - OpenStreetMap Convex handlers
- `packages/api/google-maps` - Google Maps API Convex integration

### Benefits of Convex Architecture:
1. **Real-time capabilities**: Built-in reactive queries
2. **Scalability**: Self-hosted deployment with horizontal scaling
3. **Data synchronization**: Automatic conflict resolution
4. **Offline support**: Built-in client-side caching
5. **Simplified backend**: Unified data and API layer

### Migration from tRPC:
- Full migration to Convex for all backend operations
- Self-hosted Convex deployment for production
- Gradual transition with feature flags during development

## Frontend Architecture with Convex Integration

### Current Implementation:

1. **App-Specific Configuration:**
   - Vite with React SWC for fast compilation
   - Tailwind CSS via `@tailwindcss/vite` plugin
   - TanStack Router for type-safe routing

2. **Convex Client Integration:**
   - Convex React client for data access
   - Reactive queries for real-time updates
   - Optimistic UI updates for better UX

3. **UI Package Structure:**
   - Shared components with Tailwind styling
   - Direct source imports for Vite optimization
   - Type-safe props with TypeScript

4. **App Configuration with Convex:**
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
     // Convex-specific optimizations
     optimizeDeps: {
       include: ['@tanstack/react-router', 'convex/react']
     }
   })

   // Convex client setup
   const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
   ```

### Benefits of Current Approach:
1. **Performance**: Vite's fast HMR with Convex reactive queries
2. **Type Safety**: TanStack Router + Convex TypeScript integration
3. **Developer Experience**: Hot reload with real-time data updates
4. **Scalability**: Convex handles backend scaling transparently

## OSM to Diagrammatic Maps with Convex

### Convex-Based Implementation Plan:

1. **OSM Processor Package (`packages/osm-processor`):**
   - **Convex Integration**: Store processed maps in Convex database
   - **Processing Pipeline**:
     1. Fetch OSM data via Convex HTTP actions
     2. Filter relevant transport features
     3. Apply diagrammatic transformation rules
     4. Store results in Convex with versioning
   - **Real-time Updates**: Convex reactive queries for live map updates

2. **Convex Data Model:**
   ```typescript
   // Example Convex schema for diagrammatic maps
   interface DiagrammaticMap {
     _id: Id<"maps">;
     sourceData: GeoJSON;
     processedGeometry: ProcessedGeometry;
     transformationOptions: {
       angleSnap: number;
       minDistance: number;
       lineColors: Record<string, string>;
     };
     version: string;
     createdAt: number;
     updatedAt: number;
   }

   // Convex function for processing
   export const processMap = mutation({
     args: {
       osmData: v.any(), // GeoJSON data
       options: v.object({
         angleSnap: v.number(),
         minDistance: v.number(),
         lineColors: v.record(v.string(), v.string())
       })
     },
     handler: async (ctx, args) => {
       // Process OSM data and store in Convex
       const processed = await processOSMToDiagram(args.osmData, args.options);
       return ctx.db.insert("maps", processed);
     }
   });
   ```

3. **Visualization with Convex:**
   - **Reactive Rendering**: Canvas-based visualization with Convex reactive queries
   - **Interactive Features**: Zoom/pan with Convex data pagination
   - **Collision Avoidance**: Client-side label placement with Convex data
   - **Performance**: Convex caching for smooth interactions

## Convex Migration Implementation Phases

### Phase 1: Convex Infrastructure Setup
1. **Convex Package Creation**: Set up `packages/api/convex`
2. **Self-hosted Configuration**: Docker/Kubernetes deployment
3. **Core Functions**: Authentication, logging, monitoring
4. **Development Environment**: Local Convex setup with hot reload

### Phase 2: API Integration with Convex
1. **SNCF Integration**:
   - Create Convex HTTP actions for SNCF API
   - Implement real-time data synchronization
   - Add caching layer for performance
2. **Data.gouv Integration**:
   - Set up scheduled data imports
   - Implement geospatial indexing
   - Add data quality validation
3. **OSM Integration**:
   - Create Overpass API wrappers
   - Implement GeoJSON processing
   - Add map tile generation
4. **Google Maps Integration**:
   - Wrap Google Maps APIs in Convex functions
   - Implement rate limiting
   - Add cost optimization

### Phase 3: Data Processing Pipeline
1. **OSM Processor**:
   - Implement diagrammatic transformation algorithms
   - Create worker queues for heavy processing
   - Add caching for processed results
2. **Data Fusion Engine**:
   - Combine data from all sources
   - Implement conflict resolution
   - Add quality scoring system

### Phase 4: Frontend Migration
1. **Replace tRPC with Convex**:
   - Update all API calls to use Convex client
   - Implement reactive queries
   - Add error handling and retries
2. **New Features**:
   - Multi-API source selection UI
   - Data freshness indicators
   - Performance metrics dashboard

### Phase 5: Deployment & Optimization
1. **Production Deployment**:
   - Kubernetes configuration
   - Monitoring setup (Prometheus/Grafana)
   - Backup and restore procedures
2. **Performance Optimization**:
   - Query optimization
   - Caching strategy validation
   - Load testing

## Key Technical Decisions

1. **Backend Architecture:**
   - Full migration from tRPC to Convex
   - Self-hosted Convex deployment
   - Unified data and API layer

2. **API Organization:**
   - Separate Convex packages for each API source
   - Shared Convex core for common functionality
   - Type-safe data models with Zod validation

3. **Real-time Capabilities:**
   - Reactive queries for live updates
   - WebSocket-based data synchronization
   - Optimistic UI updates

4. **Data Processing:**
   - Worker queues for heavy computations
   - Caching strategy for processed data
   - Conflict resolution algorithms

5. **Deployment Strategy:**
   - Kubernetes for orchestration
   - Horizontal pod autoscaling
   - Blue-green deployment pattern

## Questions for Clarification:

1. **Convex Deployment:**
   - Any specific performance requirements for self-hosted setup?
   - Preferred cloud provider or on-premise deployment?

2. **API Prioritization:**
   - Which API integration should we implement first?
   - Any specific SNCF or Data.gouv datasets to prioritize?

3. **Data Processing:**
   - Should OSM processing be real-time or batch-based?
   - Any specific diagrammatic transformation requirements?

4. **Authentication:**
   - Preferred auth providers (email/password, OAuth, etc.)?
   - Any specific access control requirements?

5. **Monitoring:**
   - Any existing monitoring infrastructure to integrate with?
   - Specific metrics or alerts needed?