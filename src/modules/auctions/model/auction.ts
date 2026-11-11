import type { Bid } from './bid.js';
export interface Vehicle {
  readonly brand: string;
  readonly model: string;
  readonly vin: string;
}
interface AuctionDetails {
  readonly id: string;
  readonly vehicle: Vehicle;
  readonly startingPrice: number;
  readonly currency: 'EUR';
  readonly endTime: Date;
  readonly createdAt: Date;
  readonly createdBy: string;
}
export interface DraftAuction extends AuctionDetails {
  readonly status: 'draft';
  readonly activatedAt: null;
}
export interface ActiveAuction extends AuctionDetails {
  readonly status: 'active';
  readonly activatedAt: Date;
}
export type Auction = DraftAuction | ActiveAuction;
export interface AuctionSnapshot {
  readonly auction: Auction;
  readonly highestBid: Bid | null;
}
export interface ActivationSnapshot {
  readonly auction: ActiveAuction;
  readonly highestBid: Bid | null;
}
export interface AuctionView {
  readonly highestBid: Bid | null;
  readonly winner: Bid | null;
  readonly auction: Auction;
  readonly status: 'draft' | 'active' | 'ended';
}
