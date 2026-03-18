/** File identity fields needed to construct raw storage keys. */
export interface RawStorageKeyFile {
  readonly contextKey: string;
  readonly relatedEntityId: string;
  readonly id: string;
  readonly contentType: string;
}

/** File identity fields needed to construct variant storage keys. */
export interface VariantStorageKeyFile {
  readonly contextKey: string;
  readonly relatedEntityId: string;
  readonly id: string;
}
