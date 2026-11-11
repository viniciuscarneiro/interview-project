export interface ReservationResponse {
  readonly id: string;
  readonly vehicleId: string;
  readonly buyerId: string;
  readonly status: 'active' | 'cancelled';
  readonly createdAt: string;
  readonly cancelledAt: string | null;
}
