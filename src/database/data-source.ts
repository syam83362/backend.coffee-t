import 'dotenv/config';
import { DataSource } from 'typeorm';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { UserEntity } from './entities/user.entity';
import { InitialAuthSchema1760550000000 } from './migrations/1760550000000-InitialAuthSchema';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [UserEntity, RefreshSessionEntity],
  migrations: [InitialAuthSchema1760550000000],
  synchronize: false,
});