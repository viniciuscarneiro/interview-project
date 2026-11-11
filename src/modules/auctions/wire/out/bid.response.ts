export interface BidResponse {
  readonly id: string;
  readonly auctionId: string;
  readonly buyerId: string;
  readonly amount: number;
  readonly acceptedAt: string;
}
