export class InvalidEndTimeError extends Error {
  constructor() {
    super('End time must be in the future.');
  }
}
export class InvalidStartingPriceError extends Error {
  constructor() {
    super('Starting price must be a positive safe integer.');
  }
}

export class AuctionNotFoundError extends Error {
  constructor() {
    super('Auction not found.');
  }
}
export class AuctionEndedError extends Error {
  constructor() {
    super('Auction has ended.');
  }
}
