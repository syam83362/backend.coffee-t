import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthRequest } from '../auth/auth-request';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../database/entities/user.entity';
import {
  AssignCafeStaffDto, CafeVariantConfigDto, CreateCafeDto, CreateCategoryDto,
  CreateProductDto, CreateTableDto, CreateVariantDto, GlobalVariantConfigDto, UpdateCafeDto,
} from './dto/admin.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('cafes')
  @Roles(UserRole.ADMIN, UserRole.CAFE_MANAGER)
  listCafes(@Req() request: AuthRequest) { return this.admin.listCafes(request.user); }

  @Get('cafes/:cafeId/variants')
  @Roles(UserRole.ADMIN, UserRole.CAFE_MANAGER)
  listCafeVariants(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) id: string) {
    return this.admin.listCafeVariants(request.user, id);
  }

  @Post('cafes')
  @Roles(UserRole.ADMIN)
  createCafe(@Req() request: AuthRequest, @Body() body: CreateCafeDto) { return this.admin.createCafe(request.user, body); }

  @Patch('cafes/:cafeId')
  @Roles(UserRole.ADMIN)
  updateCafe(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) id: string, @Body() body: UpdateCafeDto) { return this.admin.updateCafe(request.user, id, body); }

  @Post('cafes/:cafeId/tables')
  @Roles(UserRole.ADMIN)
  createTable(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) id: string, @Body() body: CreateTableDto) { return this.admin.createTable(request.user, id, body); }

  @Post('cafes/:cafeId/staff')
  @Roles(UserRole.ADMIN)
  assignStaff(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) id: string, @Body() body: AssignCafeStaffDto) { return this.admin.assignStaff(request.user, id, body); }

  @Post('categories')
  @Roles(UserRole.ADMIN)
  createCategory(@Req() request: AuthRequest, @Body() body: CreateCategoryDto) { return this.admin.createCategory(request.user, body); }

  @Get('products')
  @Roles(UserRole.ADMIN)
  listProducts() { return this.admin.listProducts(); }

  @Post('products')
  @Roles(UserRole.ADMIN)
  createProduct(@Req() request: AuthRequest, @Body() body: CreateProductDto) { return this.admin.createProduct(request.user, body); }

  @Post('products/:productId/variants')
  @Roles(UserRole.ADMIN)
  createVariant(@Req() request: AuthRequest, @Param('productId', ParseUUIDPipe) id: string, @Body() body: CreateVariantDto) { return this.admin.createVariant(request.user, id, body); }

  @Patch('variants/:variantId')
  @Roles(UserRole.ADMIN)
  setGlobalVariant(@Req() request: AuthRequest, @Param('variantId', ParseUUIDPipe) id: string, @Body() body: GlobalVariantConfigDto) { return this.admin.setGlobalVariant(request.user, id, body); }

  @Patch('cafes/:cafeId/variants/:variantId')
  @Roles(UserRole.ADMIN, UserRole.CAFE_MANAGER)
  setCafeVariant(@Req() request: AuthRequest, @Param('cafeId', ParseUUIDPipe) cafeId: string, @Param('variantId', ParseUUIDPipe) variantId: string, @Body() body: CafeVariantConfigDto) {
    return this.admin.setCafeVariant(request.user, cafeId, variantId, body);
  }

  @Get('audit')
  @Roles(UserRole.ADMIN)
  auditLogs(@Req() request: AuthRequest) { return this.admin.auditLogs(request.user); }
}