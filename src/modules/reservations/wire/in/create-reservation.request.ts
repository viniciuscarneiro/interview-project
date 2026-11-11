import { IsUUID } from 'class-validator';

export class CreateReservationRequest {
  @IsUUID()
  vehicleId!: string;

  @IsUUID()
  buyerId!: string;
}
