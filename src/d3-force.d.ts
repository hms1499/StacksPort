declare module 'd3-force' {
  export interface SimulationNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }

  export interface Simulation<NodeDatum extends SimulationNodeDatum> {
    restart(): Simulation<NodeDatum>;
    stop(): Simulation<NodeDatum>;
    tick(): Simulation<NodeDatum>;
    force(name: string, force?: Force<NodeDatum> | null): Force<NodeDatum> | undefined | Simulation<NodeDatum>;
    velocityDecay(decay?: number): number | Simulation<NodeDatum>;
    alpha(alpha?: number): number | Simulation<NodeDatum>;
    alphaMin(min?: number): number | Simulation<NodeDatum>;
    alphaDecay(decay?: number): number | Simulation<NodeDatum>;
    alphaTarget(target?: number): number | Simulation<NodeDatum>;
    on(typenames: string, listener?: ((simulation: Simulation<NodeDatum>) => void) | null): Simulation<NodeDatum>;
    nodes(): NodeDatum[];
    nodes(nodes: NodeDatum[]): Simulation<NodeDatum>;
    find(x: number, y: number, radius?: number): NodeDatum | undefined;
  }

  export interface Force<NodeDatum extends SimulationNodeDatum> {
    (alpha: number): void;
  }

  export function forceSimulation<NodeDatum extends SimulationNodeDatum>(nodes?: NodeDatum[]): Simulation<NodeDatum>;

  export function forceCollide<NodeDatum extends SimulationNodeDatum>(radius?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): Force<NodeDatum> & {
    radius(radius?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): Force<NodeDatum> & { radius: any; strength: any };
    strength(strength?: number): Force<NodeDatum> & { radius: any; strength: any };
  };

  export function forceCenter<NodeDatum extends SimulationNodeDatum>(x?: number, y?: number): Force<NodeDatum> & {
    x(x?: number): number | (Force<NodeDatum> & { x: any; y: any });
    y(y?: number): number | (Force<NodeDatum> & { x: any; y: any });
    strength(strength?: number): number | (Force<NodeDatum> & { x: any; y: any; strength: any });
  };

  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): Force<NodeDatum> & {
    strength(strength?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): Force<NodeDatum> & { strength: any; distanceMin: any; distanceMax: any; theta: any };
    distanceMin(distance?: number): Force<NodeDatum> & { strength: any; distanceMin: any; distanceMax: any; theta: any };
    distanceMax(distance?: number): Force<NodeDatum> & { strength: any; distanceMin: any; distanceMax: any; theta: any };
    theta(theta?: number): Force<NodeDatum> & { strength: any; distanceMin: any; distanceMax: any; theta: any };
  };
}
