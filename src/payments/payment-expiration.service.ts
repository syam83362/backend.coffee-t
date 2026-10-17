import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { OrderEntity } from '../database/entities/order.entity';
import { PaymentAttemptEntity, PaymentAttemptStatus } from '../database/entities/payment-attempt.entity';
import { PaymentEventEntity } from '../database/entities/payment-event.entity';
import { OrderStatus } from '../database/entities/order.entity';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpirationService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly dataSource: DataSource, private readonly payments: PaymentsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.expirePendingAttempts().catch(() => this.logger.error('Could not expire pending payment reservations'));
    }, 60_000);
    this.timer.unref();
    void this.expirePendingAttempts().catch(() => this.logger.error('Could not expire pending payment reservations'));
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async expirePendingAttempts(): Promise<void> {
    const candidates = await this.dataSource.getRepository(PaymentAttemptEntity)
      .createQueryBuilder('attempt')
      .select('attempt.id', 'id')
      .where('attempt.status = :status AND attempt.expiresAt <= CURRENT_TIMESTAMP', { status: PaymentAttemptStatus.PENDING })
      .getRawMany<{ id: string }>();
    for (const candidate of candidates) await this.expireAttempt(candidate.id);
    await this.expireUnattemptedOrders();
  }

  private async expireUnattemptedOrders(): Promise<void> {
    const candidates = await this.dataSource.getRepository(OrderEntity)
      .createQueryBuilder('order')
      .select('order.id', 'id')
      .where('order.status = :status AND order.stockReserved = true AND order.paymentExpiresAt <= CURRENT_TIMESTAMP', {
        status: OrderStatus.PENDING_PAYMENT,
      })
      .andWhere('NOT EXISTS (SELECT 1 FROM payment_attempts attempt WHERE attempt.order_id = order.id AND attempt.status = :pending)', {
        pending: PaymentAttemptStatus.PENDING,
      })
      .getRawMany<{ id: string }>();
    for (const candidate of candidates) await this.expireUnattemptedOrder(candidate.id);
  }

  private async expireUnattemptedOrder(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(OrderEntity)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId AND order.status = :status AND order.stockReserved = true AND order.paymentExpiresAt <= CURRENT_TIMESTAMP', {
          orderId,
          status: OrderStatus.PENDING_PAYMENT,
        })
        .getOne();
      if (!order) return;
      const pending = await manager.getRepository(PaymentAttemptEntity).findOne({
        where: { orderId, status: PaymentAttemptStatus.PENDING },
      });
      if (pending) return;
      await this.payments.releaseReservedStock(manager, orderId);
      order.stockReserved = false;
      order.status = OrderStatus.CANCELLED;
      await manager.getRepository(OrderEntity).save(order);
    });
  }

  private async expireAttempt(attemptId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const attempt = await manager.getRepository(PaymentAttemptEntity)
        .createQueryBuilder('attempt')
        .setLock('pessimistic_write')
        .where('attempt.id = :attemptId AND attempt.status = :status AND attempt.expiresAt <= CURRENT_TIMESTAMP', {
          attemptId,
          status: PaymentAttemptStatus.PENDING,
        })
        .getOne();
      if (!attempt) return;
      const order = await manager.getRepository(OrderEntity)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId: attempt.orderId })
        .getOne();
      if (!order) return;
      const events = manager.getRepository(PaymentEventEntity);
      await events.save(events.create({
        id: randomUUID(),
        attemptId: attempt.id,
        providerEventId: `expiry-${attempt.id}`,
        eventType: 'payment.expired',
        details: { reason: 'payment_window_elapsed' },
      }));
      attempt.status = PaymentAttemptStatus.FAILED;
      await manager.getRepository(PaymentAttemptEntity).save(attempt);
      if (order.stockReserved) {
        await this.payments.releaseReservedStock(manager, order.id);
        order.stockReserved = false;
        await manager.getRepository(OrderEntity).save(order);
      }
    });
  }
}