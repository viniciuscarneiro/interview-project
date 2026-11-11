import { AuctionsModule } from './modules/auctions/auctions.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';

@Module({ imports: [HealthModule, AuthModule, AuctionsModule] })
export class AppModule {}
