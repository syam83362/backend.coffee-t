import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategoryEntity } from '../database/entities/product-category.entity';
import { ProductEntity } from '../database/entities/product.entity';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, ProductCategoryEntity])],
  controllers: [CatalogueController],
  providers: [CatalogueService],
})
export class CatalogueModule {}