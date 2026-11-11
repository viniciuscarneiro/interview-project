import { AuctionErrorFilter } from './diplomat/http/auction-error.filter.js';
import { PlaceBid } from './use-cases/place-bid.js';
import type { BidStore } from './use-cases/ports/bid-store.js';
import { PrismaBidStore } from './diplomat/database/prisma-bid-store.js';
import { ActivateAuction } from './use-cases/activate-auction.js';
import type { AuctionActivationStore } from './use-cases/ports/auction-activation-store.js';
import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  BID_STORE,
  AUCTION_STORE,
  AUCTION_RUNTIME,
  AUCTION_ACTIVATION_STORE,
} from './auctions.tokens.js';
import { PrismaAuctionStore } from './diplomat/database/prisma-auction-store.js';
import { AuctionsController } from './diplomat/http/auctions.controller.js';
import { CreateAuction } from './use-cases/create-auction.js';
import { ListAuctions } from './use-cases/list-auctions.js';
import type { AuctionStore } from './use-cases/ports/auction-store.js';
import type { AuctionRuntime } from './use-cases/ports/auction-runtime.js';
@Module({
  imports: [DatabaseModule],
  controllers: [AuctionsController],
  providers: [
    AuctionErrorFilter,
    {
      provide: BID_STORE,
      inject: [PrismaService],
      useFactory: (database: PrismaService) => new PrismaBidStore(database),
    },
    {
      provide: PlaceBid,
      inject: [BID_STORE, AUCTION_RUNTIME],
      useFactory: (store: BidStore, runtime: AuctionRuntime) => new PlaceBid(store, runtime),
    },
    { provide: AUCTION_ACTIVATION_STORE, useExisting: AUCTION_STORE },
    {
      provide: ActivateAuction,
      inject: [AUCTION_ACTIVATION_STORE, AUCTION_RUNTIME],
      useFactory: (store: AuctionActivationStore, runtime: AuctionRuntime) =>
        new ActivateAuction(store, runtime),
    },
    {
      provide: AUCTION_STORE,
      inject: [PrismaService],
      useFactory: (database: PrismaService) => new PrismaAuctionStore(database),
    },
    {
      provide: AUCTION_RUNTIME,
      useValue: { now: () => new Date(), newId: randomUUID } satisfies AuctionRuntime,
    },
    {
      provide: CreateAuction,
      inject: [AUCTION_STORE, AUCTION_RUNTIME],
      useFactory: (store: AuctionStore, runtime: AuctionRuntime) =>
        new CreateAuction(store, runtime),
    },
    {
      provide: ListAuctions,
      inject: [AUCTION_STORE, AUCTION_RUNTIME],
      useFactory: (store: AuctionStore, runtime: AuctionRuntime) =>
        new ListAuctions(store, runtime),
    },
  ],
})
export class AuctionsModule {}
