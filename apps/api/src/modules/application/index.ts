// =============================================================================
// Application Layer – Use case interfaces (Ports)
// =============================================================================

export interface RepositoryPort<T, TId> {
  findById(id: TId): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: TId, entity: Partial<T>): Promise<T>;
  delete(id: TId): Promise<void>;
}
