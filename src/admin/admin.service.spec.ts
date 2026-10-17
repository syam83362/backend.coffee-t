import { ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CafeEntity } from '../database/entities/cafe.entity';
import { ProductEntity } from '../database/entities/product.entity';
import { UserRole } from '../database/entities/user.entity';
import { AdminService } from './admin.service';

describe('AdminService café scope', () => {
  it('rejects a café manager changing another café inventory', async () => {
    const assignmentRepository = { findOne: jest.fn().mockResolvedValue(null) };
    const manager = { getRepository: jest.fn(() => assignmentRepository) };
    const dataSource = { transaction: jest.fn((callback) => callback(manager)), manager } as unknown as DataSource;
    const service = new AdminService(dataSource, {} as Repository<CafeEntity>, {} as Repository<ProductEntity>);
    const cafeManager = { id: 'manager-id', role: UserRole.CAFE_MANAGER } as AuthenticatedRequestUser;

    await expect(service.setCafeVariant(cafeManager, 'unassigned-cafe', 'variant-id', {
      isAvailable: true,
      quantity: 10,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(assignmentRepository.findOne).toHaveBeenCalledWith({
      where: { cafeId: 'unassigned-cafe', userId: cafeManager.id },
    });
    expect(manager.getRepository).toHaveBeenCalledTimes(1);
  });
});