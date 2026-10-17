import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthRequest } from '../auth/auth-request';
import { RolesGuard } from '../auth/roles.guard';
import { CafesService } from './cafes.service';
import { DiningOrderDto, TableOrderDto } from './dto/dining-order.dto';
import { AssistedOrderDto } from './dto/assisted-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller()
export class CafesController {
  constructor(private readonly cafes: CafesService) {}

  @Get('cafes')
  listCafes() {
    return this.cafes.listCafes();
  }

  @Get('table/:tableCode')
  getTable(
    @Param('tableCode') tableCode: string,
    @Headers('x-cafe-table-token') token?: string,
  ) {
    return this.cafes.getTableContext(tableCode, token);
  }

  @Post('table/:tableCode/waiter-call')
  callWaiter(
    @Param('tableCode') tableCode: string,
    @Headers('x-cafe-table-token') token?: string,
  ) {
    return this.cafes.callWaiter(tableCode, token);
  }

  @Post('table/:tableCode/orders')
  createTableOrder(
    @Param('tableCode') tableCode: string,
    @Headers('x-cafe-table-token') token: string | undefined,
    @Body() body: TableOrderDto,
  ) {
    return this.cafes.createTableOrder(tableCode, token, body);
  }

  @Get('staff/cafes')
  @UseGuards(AccessTokenGuard, RolesGuard)
  listStaffCafes(@Req() request: AuthRequest) {
    return this.cafes.listAssignedCafes(request.user);
  }

  @Get('staff/cafes/:cafeId/waiter-calls')
  @UseGuards(AccessTokenGuard, RolesGuard)
  listWaiterCalls(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) cafeId: string) {
    return this.cafes.listWaiterCalls(request.user, cafeId);
  }

  @Get('staff/cafes/:cafeId/tables')
  @UseGuards(AccessTokenGuard, RolesGuard)
  listCafeTables(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) cafeId: string) {
    return this.cafes.listCafeTables(request.user, cafeId);
  }

  @Get('staff/cafes/:cafeId/pending-orders')
  @UseGuards(AccessTokenGuard, RolesGuard)
  listPendingOrders(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) cafeId: string) {
    return this.cafes.listPendingOrders(request.user, cafeId);
  }

  @Post('staff/waiter-calls/:callId/resolve')
  @UseGuards(AccessTokenGuard, RolesGuard)
  resolveWaiterCall(@Req() request: AuthRequest, @Param('callId', ParseUUIDPipe) callId: string) {
    return this.cafes.resolveWaiterCall(request.user, callId);
  }

  @Post('staff/cafes/:cafeId/tables/:tableId/assisted-orders')
  @UseGuards(AccessTokenGuard, RolesGuard)
  createAssistedOrder(
    @Req() request: AuthRequest,
    @Param('cafeId', ParseUUIDPipe) cafeId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body() body: AssistedOrderDto,
  ) {
    return this.cafes.createAssistedOrder(request.user, cafeId, tableId, body);
  }

  @Post('staff/orders/:orderId/cash-collection')
  @UseGuards(AccessTokenGuard, RolesGuard)
  recordCash(@Req() request: AuthRequest, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.cafes.recordCashCollection(request.user, orderId);
  }

  @Patch('staff/orders/:orderId/status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  updateOrderStatus(
    @Req() request: AuthRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.cafes.updateOrderStatus(request.user, orderId, body.status);
  }

  @Get('staff/cafes/:cafeId/orders')
  @UseGuards(AccessTokenGuard, RolesGuard)
  getDisplayOrders(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) cafeId: string) {
    return this.cafes.displayOrders(request.user, cafeId);
  }

  @Sse('staff/cafes/:cafeId/display/stream')
  @UseGuards(AccessTokenGuard, RolesGuard)
  displayStream(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) cafeId: string) {
    return this.cafes.displayStream(request.user, cafeId);
  }
}