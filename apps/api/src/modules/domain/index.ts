// =============================================================================
// Domain Layer – Entity definitions
// =============================================================================

export interface Entity<TId> {
  id: TId;
  createdAt: Date;
  updatedAt: Date;
}
