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
    force(name: string): Force | undefined;
    force(name: string, force: Force | null): Simulation<NodeDatum>;
    velocityDecay(): number;
    velocityDecay(decay: number): Simulation<NodeDatum>;
    alpha(): number;
    alpha(alpha: number): Simulation<NodeDatum>;
    alphaMin(): number;
    alphaMin(min: number): Simulation<NodeDatum>;
    alphaDecay(): number;
    alphaDecay(decay: number): Simulation<NodeDatum>;
    alphaTarget(): number;
    alphaTarget(target: number): Simulation<NodeDatum>;
    on(typenames: string, listener?: ((simulation: Simulation<NodeDatum>) => void) | null): Simulation<NodeDatum>;
    nodes(): NodeDatum[];
    nodes(nodes: NodeDatum[]): Simulation<NodeDatum>;
    find(x: number, y: number, radius?: number): NodeDatum | undefined;
  }

  export interface Force {
    (alpha: number): void;
  }

  export interface CollideForce<NodeDatum extends SimulationNodeDatum> {
    (alpha: number): void;
    radius(): number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number);
    radius(radius: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): CollideForce<NodeDatum>;
    strength(): number;
    strength(strength: number): CollideForce<NodeDatum>;
  }

  export interface CenterForce<NodeDatum extends SimulationNodeDatum> {
    (alpha: number): void;
    x(): number;
    x(x: number): CenterForce<NodeDatum>;
    y(): number;
    y(y: number): CenterForce<NodeDatum>;
    strength(): number;
    strength(strength: number): CenterForce<NodeDatum>;
  }

  export interface ManyBodyForce<NodeDatum extends SimulationNodeDatum> {
    (alpha: number): void;
    strength(): number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number);
    strength(strength: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): ManyBodyForce<NodeDatum>;
    distanceMin(): number;
    distanceMin(distance: number): ManyBodyForce<NodeDatum>;
    distanceMax(): number;
    distanceMax(distance: number): ManyBodyForce<NodeDatum>;
    theta(): number;
    theta(theta: number): ManyBodyForce<NodeDatum>;
  }

  export function forceSimulation<NodeDatum extends SimulationNodeDatum>(nodes?: NodeDatum[]): Simulation<NodeDatum>;

  export function forceCollide<NodeDatum extends SimulationNodeDatum>(radius?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number)): CollideForce<NodeDatum>;

  export function forceCenter<NodeDatum extends SimulationNodeDatum>(x?: number, y?: number): CenterForce<NodeDatum>;

  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ManyBodyForce<NodeDatum>;
}
