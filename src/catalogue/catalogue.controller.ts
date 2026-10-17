import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ProductChannel } from '../database/entities/product-availability.entity';
import { CatalogueService } from './catalogue.service';
import { ListProductsDto } from './dto/list-products.dto';

@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('categories')
  listCategories() {
    return this.catalogue.listCategories();
  }

  @Get('products')
  listProducts(@Query() query: ListProductsDto) {
    return this.catalogue.listProducts(query);
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string, @Query() query: ListProductsDto) {
    return this.catalogue.getProduct(slug, {
      channel: query.channel ?? ProductChannel.ONLINE,
      cafeId: query.cafeId,
    });
  }
}