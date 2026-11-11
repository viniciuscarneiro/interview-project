import { BadRequestException } from '@nestjs/common';
export function validateActivationBody(body: unknown): void {
  if (body === undefined) return;
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length > 0
  ) {
    throw new BadRequestException({
      statusCode: 400,
      message: ['Activation does not accept body fields.'],
      error: 'Bad Request',
    });
  }
}
