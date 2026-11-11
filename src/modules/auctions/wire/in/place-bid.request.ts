import { IsInt, Min, Max } from 'class-validator';
export class PlaceBidRequest {
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) amount!: number;
}
