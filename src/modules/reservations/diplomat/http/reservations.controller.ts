import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { CreateReservation } from '../../use-cases/create-reservation.js';
import { GetReservation } from '../../use-cases/get-reservation.js';
import { CancelReservation } from '../../use-cases/cancel-reservation.js';
import { CreateReservationRequest } from '../../wire/in/create-reservation.request.js';
import type { ReservationResponse } from '../../wire/out/reservation.response.js';
import {
  toCreateReservationInput,
  toReservationResponse,
} from '../../adapters/reservation.http.adapter.js';
import { ReservationErrorFilter } from './reservation-error.filter.js';

@Controller('reservations')
@UseFilters(ReservationErrorFilter)
export class ReservationsController {
  constructor(
    @Inject(CreateReservation) private readonly createReservation: CreateReservation,
    @Inject(GetReservation) private readonly getReservation: GetReservation,
    @Inject(CancelReservation) private readonly cancelReservation: CancelReservation,
  ) {}

  @Post()
  async create(@Body() request: CreateReservationRequest): Promise<ReservationResponse> {
    return toReservationResponse(
      await this.createReservation.execute(toCreateReservationInput(request)),
    );
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string): Promise<ReservationResponse> {
    return toReservationResponse(await this.getReservation.execute(id));
  }

  @Delete(':id')
  async cancel(@Param('id', new ParseUUIDPipe()) id: string): Promise<ReservationResponse> {
    return toReservationResponse(await this.cancelReservation.execute(id));
  }
}
