import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthRequest } from '../auth/auth-request';
import { CheckoutDto } from './dto/checkout.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { SetCartItemDto } from './dto/set-cart-item.dto';
import { OrdersService } from './orders.service';

@Controller()
@UseGuards(AccessTokenGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('addresses')
  listAddresses(@Req() request: AuthRequest) {
    return this.orders.listAddresses(request.user);
  }

  @Post('addresses')
  createAddress(@Req() request: AuthRequest, @Body() body: CreateAddressDto) {
    return this.orders.createAddress(request.user, body);
  }

  @Get('cart')
  getCart(@Req() request: AuthRequest) {
    return this.orders.getCart(request.user);
  }

  @Put('cart/items/:variantId')
  setCartItem(
    @Req() request: AuthRequest,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: SetCartItemDto,
  ) {
    return this.orders.setCartItem(request.user, variantId, body);
  }

  @Post('cart/items/:variantId')
  addCartItem(
    @Req() request: AuthRequest,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: SetCartItemDto,
  ) {
    return this.orders.addCartItem(request.user, variantId, body);
  }

  @Delete('cart/items/:variantId')
  removeCartItem(
    @Req() request: AuthRequest,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.orders.removeCartItem(request.user, variantId);
  }

  @Post('orders/checkout')
  checkout(@Req() request: AuthRequest, @Body() body: CheckoutDto) {
    return this.orders.checkout(request.user, body.addressId);
  }

  @Get('orders')
  listOrders(@Req() request: AuthRequest) {
    return this.orders.listOrders(request.user);
  }

  @Get('orders/:orderId')
  getOrder(
    @Req() request: AuthRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.getOrder(request.user, orderId);
  }
}