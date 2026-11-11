import { Catch } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  InvalidEndTimeError,
  InvalidStartingPriceError,
  AuctionNotFoundError,
  AuctionEndedError,
} from '../../model/auction.errors.js';
import {
  AuctionNotActiveError,
  BidTooLowError,
  InvalidBidAmountError,
} from '../../model/bid.errors.js';

const responses = [
  [InvalidEndTimeError, 400, 'INVALID_END_TIME'],
  [InvalidStartingPriceError, 400, 'INVALID_STARTING_PRICE'],
  [InvalidBidAmountError, 400, 'INVALID_BID_AMOUNT'],
  [AuctionNotFoundError, 404, 'AUCTION_NOT_FOUND'],
  [AuctionEndedError, 409, 'AUCTION_ENDED'],
  [AuctionNotActiveError, 409, 'AUCTION_NOT_ACTIVE'],
  [BidTooLowError, 409, 'BID_TOO_LOW'],
] as const;

@Catch(...responses.map(([type]) => type))
export class AuctionErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const match = responses.find(([type]) => error instanceof type);
    if (!match) throw error;
    const [, statusCode, code] = match;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, code, message: error.message });
  }
}
