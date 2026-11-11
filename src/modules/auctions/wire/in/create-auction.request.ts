import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  IsString,
  Length,
  Matches,
  IsInt,
  Min,
  Max,
  IsISO8601,
  ValidateNested,
} from 'class-validator';
export class VehicleRequest {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  brand!: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  model!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/)
  vin!: string;
}
export class CreateAuctionRequest {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => VehicleRequest)
  vehicle!: VehicleRequest;
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  startingPrice!: number;
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  endTime!: string;
}
