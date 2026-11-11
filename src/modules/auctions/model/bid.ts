export interface Bid {
  readonly id: string;
  readonly auctionId: string;
  readonly buyerId: string;
  readonly amount: number;
  readonly acceptedAt: Date;
  readonly acceptanceOrder: bigint;
}
export interface PlaceBidInput {
  readonly auctionId: string;
  readonly buyerId: string;
  readonly amount: number;
}
