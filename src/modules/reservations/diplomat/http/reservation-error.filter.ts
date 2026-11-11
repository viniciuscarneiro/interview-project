import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { VehicleAlreadyReservedError } from '../../model/reservation.errors.js';
import { ReservationNotFoundError } from '../../use-cases/reservation.errors.js';

@Catch(VehicleAlreadyReservedError, ReservationNotFoundError)
export class ReservationErrorFilter implements ExceptionFilter {
  catch(error: VehicleAlreadyReservedError | ReservationNotFoundError, host: ArgumentsHost): void {
    const conflict = error instanceof VehicleAlreadyReservedError;
    const statusCode = conflict ? HttpStatus.CONFLICT : HttpStatus.NOT_FOUND;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({
        statusCode,
        code: conflict ? 'VEHICLE_ALREADY_RESERVED' : 'RESERVATION_NOT_FOUND',
        message: error.message,
      });
  }
}
