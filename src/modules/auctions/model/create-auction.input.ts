import type { Vehicle } from './auction.js';
export interface CreateAuctionInput {
  readonly vehicle: Vehicle;
  readonly startingPrice: number;
  readonly endTime: Date;
  readonly createdBy: string;
}
