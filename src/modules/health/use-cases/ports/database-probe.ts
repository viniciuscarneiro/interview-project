export interface DatabaseProbe {
  /** Resolve when the database can serve a query; reject on unavailable/failed access. */
  check(): Promise<void>;
}
