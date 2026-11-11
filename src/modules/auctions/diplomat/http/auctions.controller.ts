import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Inject,
  Param,
  HttpCode,
  UseFilters,
} from '@nestjs/common';
import { Roles, CurrentActor } from '../../../auth/diplomat/http/auth.decorators.js';
import type { Actor } from '../../../auth/model/actor.js';
import { CreateAuction } from '../../use-cases/create-auction.js';
import { ListAuctions } from '../../use-cases/list-auctions.js';
import { ActivateAuction } from '../../use-cases/activate-auction.js';
import { PlaceBid } from '../../use-cases/place-bid.js';
import { CreateAuctionRequest } from '../../wire/in/create-auction.request.js';
import { ListAuctionsRequest } from '../../wire/in/list-auctions.request.js';
import { AuctionIdRequest } from '../../wire/in/auction-id.request.js';
import { PlaceBidRequest } from '../../wire/in/place-bid.request.js';
import type { AuctionResponse, AuctionPageResponse } from '../../wire/out/auction.response.js';
import type { BidResponse } from '../../wire/out/bid.response.js';
import {
  toAuctionReference,
  toCreateAuctionInput,
  toListAuctionsInput,
  toAuctionResponse,
  toAuctionPageResponse,
} from '../../adapters/auction.http.adapter.js';
import { toPlaceBidInput, toBidResponse } from '../../adapters/bid.http.adapter.js';
import { validateActivationBody } from './activation-body.js';
import { AuctionErrorFilter } from './auction-error.filter.js';

@Controller('auctions')
@UseFilters(AuctionErrorFilter)
export class AuctionsController {
  constructor(
    @Inject(PlaceBid) private readonly placeBid: PlaceBid,
    @Inject(ActivateAuction) private readonly activateAuction: ActivateAuction,
    @Inject(CreateAuction) private readonly createAuction: CreateAuction,
    @Inject(ListAuctions) private readonly listAuctions: ListAuctions,
  ) {}
  @Post()
  @Roles('ADMIN')
  async create(
    @Body() request: CreateAuctionRequest,
    @CurrentActor() actor: Actor,
  ): Promise<AuctionResponse> {
    return toAuctionResponse(
      await this.createAuction.execute(toCreateAuctionInput(request, actor)),
    );
  }
  @Post(':id/activate')
  @HttpCode(200)
  @Roles('ADMIN')
  async activate(
    @Param() reference: AuctionIdRequest,
    @Body() body: unknown,
  ): Promise<AuctionResponse> {
    validateActivationBody(body);
    return toAuctionResponse(await this.activateAuction.execute(toAuctionReference(reference)));
  }
  @Post(':id/bids')
  @Roles('BASIC')
  async bid(
    @Param() reference: AuctionIdRequest,
    @Body() request: PlaceBidRequest,
    @CurrentActor() actor: Actor,
  ): Promise<BidResponse> {
    return toBidResponse(await this.placeBid.execute(toPlaceBidInput(reference, request, actor)));
  }
  @Get()
  @Roles('ADMIN', 'BASIC')
  async list(@Query() request: ListAuctionsRequest): Promise<AuctionPageResponse> {
    return toAuctionPageResponse(await this.listAuctions.execute(toListAuctionsInput(request)));
  }
}
