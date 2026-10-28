import 'dotenv/config';
import { DataSource } from 'typeorm';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { UserEntity } from './entities/user.entity';
import { InitialAuthSchema1760550000000 } from './migrations/1760550000000-InitialAuthSchema';
import { CafeEntity } from './entities/cafe.entity';
import { ProductAvailabilityEntity } from './entities/product-availability.entity';
import { ProductCategoryEntity } from './entities/product-category.entity';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { SharedCatalogue1760650000000 } from './migrations/1760650000000-SharedCatalogue';
import { CartEntity } from './entities/cart.entity';
import { CartItemEntity } from './entities/cart-item.entity';
import { DeliveryAddressEntity } from './entities/delivery-address.entity';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { CustomerOrders1760750000000 } from './migrations/1760750000000-CustomerOrders';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity';
import { PaymentEventEntity } from './entities/payment-event.entity';
import { PaymentLifecycle1760850000000 } from './migrations/1760850000000-PaymentLifecycle';
import { CafeTableEntity } from './entities/cafe-table.entity';
import { CafeStaffAssignmentEntity } from './entities/cafe-staff-assignment.entity';
import { CashCollectionEntity } from './entities/cash-collection.entity';
import { WaiterCallEntity } from './entities/waiter-call.entity';
import { CafeOperations1760950000000 } from './migrations/1760950000000-CafeOperations';
import { CafeReservationEntity } from './entities/cafe-reservation.entity';
import { CafeReservations1761050000000 } from './migrations/1761050000000-CafeReservations';
import { CafeInventoryEntity } from './entities/cafe-inventory.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { CafeInventoryAudit1761150000000 } from './migrations/1761150000000-CafeInventoryAudit';
import { PaymentAttemptExpiry1761160000000 } from './migrations/1761160000000-PaymentAttemptExpiry';
import { UnattemptedOrderExpiry1761170000000 } from './migrations/1761170000000-UnattemptedOrderExpiry';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    UserEntity,
    RefreshSessionEntity,
    CafeEntity,
    ProductAvailabilityEntity,
    ProductCategoryEntity,
    ProductEntity,
    ProductVariantEntity,
    CartEntity,
    CartItemEntity,
    DeliveryAddressEntity,
    OrderEntity,
    OrderItemEntity,
    PaymentAttemptEntity,
    PaymentEventEntity,
    CafeTableEntity,
    CafeStaffAssignmentEntity,
    CashCollectionEntity,
    WaiterCallEntity,
    CafeReservationEntity,
    CafeInventoryEntity,
    AuditLogEntity,
  ],
  migrations: [
    InitialAuthSchema1760550000000,
    SharedCatalogue1760650000000,
    CustomerOrders1760750000000,
    PaymentLifecycle1760850000000,
    CafeOperations1760950000000,
    CafeReservations1761050000000,
    CafeInventoryAudit1761150000000,
    PaymentAttemptExpiry1761160000000,
    UnattemptedOrderExpiry1761170000000,
  ],
  synchronize: false,
});