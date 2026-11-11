export class AuctionNotActiveError extends Error {
  constructor() {
    super('Auction is not active.');
  }
}
export class BidTooLowError extends Error {
  constructor() {
    super('Bid must meet the starting price and current highest bid.');
  }
}
export class InvalidBidAmountError extends Error {
  constructor() {
    super('Bid amount must be a positive safe integer.');
  }
}
