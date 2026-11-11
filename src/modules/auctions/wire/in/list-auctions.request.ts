import { Transform } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';
function parseInteger(value: unknown): unknown {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : value;
}
export class ListAuctionsRequest {
  @Transform(({ value }: { value: unknown }) => parseInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
  @Transform(({ value }: { value: unknown }) => parseInteger(value))
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  offset: number = 0;
}
