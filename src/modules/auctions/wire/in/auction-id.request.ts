import { IsUUID } from 'class-validator';
export class AuctionIdRequest {
  @IsUUID() id!: string;
}
