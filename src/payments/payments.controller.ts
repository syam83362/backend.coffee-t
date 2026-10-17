import {
  Body,
  Controller,
  Headers,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthRequest } from '../auth/auth-request';
import { ResolveDevelopmentPaymentDto } from './dto/resolve-development-payment.dto';
import { StartPaymentDto } from './dto/start-payment.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('orders/:orderId/payments')
  @UseGuards(AccessTokenGuard)
  start(
    @Req() request: AuthRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: StartPaymentDto,
  ) {
    return this.payments.start(request.user, orderId, body.idempotencyKey);
  }

  @Get('orders/:orderId/payments')
  @UseGuards(AccessTokenGuard)
  list(@Req() request: AuthRequest, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.listForOrder(request.user, orderId);
  }

  @Post('orders/:orderId/payments/:attemptId/development-resolution')
  @UseGuards(AccessTokenGuard)
  resolveDevelopment(
    @Req() request: AuthRequest,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: ResolveDevelopmentPaymentDto,
  ) {
    return this.payments.resolveDevelopment(request.user, attemptId, body.outcome);
  }

  @Post('table/:tableCode/orders/:orderId/payments')
  startTablePayment(
    @Param('tableCode') tableCode: string,
    @Headers('x-cafe-table-token') token: string | undefined,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: StartPaymentDto,
  ) {
    return this.payments.startForTable(tableCode, token, orderId, body.idempotencyKey);
  }

  @Post('table/:tableCode/payments/:attemptId/development-resolution')
  resolveTableDevelopment(
    @Param('tableCode') tableCode: string,
    @Headers('x-cafe-table-token') token: string | undefined,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: ResolveDevelopmentPaymentDto,
  ) {
    return this.payments.resolveDevelopmentForTable(tableCode, token, attemptId, body.outcome);
  }
}