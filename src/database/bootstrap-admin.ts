import 'dotenv/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { UserEntity, UserRole } from './entities/user.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';

async function bootstrapAdmin(): Promise<void> {
  if (process.env.ADMIN_BOOTSTRAP_ENABLED !== 'true') {
    throw new Error('Set ADMIN_BOOTSTRAP_ENABLED=true for this one-time operation');
  }
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || password.length > 128) {
    throw new Error('Provide BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD between 12 and 128 characters');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [UserEntity, RefreshSessionEntity],
    synchronize: false,
  });
  await dataSource.initialize();
  try {
    const users = dataSource.getRepository(UserEntity);
    const adminCount = await users.count({ where: { role: UserRole.ADMIN } });
    if (adminCount > 0) throw new Error('A platform administrator already exists; bootstrap is one-time only');
    if (await users.findOne({ where: { email } })) throw new Error('That email is already registered');
    await users.save(users.create({
      id: randomUUID(),
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: UserRole.ADMIN,
      isActive: true,
    }));
  } finally {
    await dataSource.destroy();
  }
  console.log('Platform administrator created. The bootstrap operation will not run again while an admin exists.');
}

void bootstrapAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin bootstrap failed.');
  process.exitCode = 1;
});