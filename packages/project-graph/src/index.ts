/** Entity node in the Caelis project graph. */
export interface ProjectEntity {
  key: string;
  type: string;
  name: string;
  sourcePath: string;
}

/** Directed relationship between two project entities. */
export interface ProjectRelationship {
  from: string;
  type: string;
  to: string;
}

/** Read model for adjacent graph data. */
export interface ProjectNeighbours {
  entity: ProjectEntity;
  outgoing: ProjectRelationship[];
  incoming: ProjectRelationship[];
}

/** Minimal in-memory graph for early project indexing experiments. */
export class InMemoryProjectGraph {
  private readonly entities = new Map<string, ProjectEntity>();
  private readonly relationships: ProjectRelationship[] = [];

  /** Add or replace an entity by key. */
  public addEntity(entity: ProjectEntity): void {
    this.entities.set(entity.key, entity);
  }

  /** Add a directed relationship. */
  public addRelationship(relationship: ProjectRelationship): void {
    this.relationships.push(relationship);
  }

  /** Return neighbours for a known entity key. */
  public getNeighbours(key: string): ProjectNeighbours | undefined {
    const entity = this.entities.get(key);
    if (!entity) {
      return undefined;
    }

    return {
      entity,
      outgoing: this.relationships.filter(
        (relationship) => relationship.from === key
      ),
      incoming: this.relationships.filter(
        (relationship) => relationship.to === key
      )
    };
  }

  /** Return all entities currently tracked by the graph. */
  public getEntities(): ProjectEntity[] {
    return [...this.entities.values()];
  }
}
