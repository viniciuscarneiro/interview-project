export class VehicleAlreadyReservedError extends Error {
  constructor() {
    super('Vehicle already has an active reservation.');
    this.name = 'VehicleAlreadyReservedError';
  }
}
