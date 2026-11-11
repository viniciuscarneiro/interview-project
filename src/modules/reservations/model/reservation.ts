interface ReservationIdentity {
  readonly id: string;
  readonly vehicleId: string;
  readonly buyerId: string;
  readonly createdAt: Date;
}

export type ActiveReservation = ReservationIdentity & {
  readonly status: 'active';
  readonly cancelledAt: null;
};

export type CancelledReservation = ReservationIdentity & {
  readonly status: 'cancelled';
  readonly cancelledAt: Date;
};

export type Reservation = ActiveReservation | CancelledReservation;
