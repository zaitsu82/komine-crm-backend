import { resolveDatabaseUrl } from '../../src/db/databaseUrl';

describe('resolveDatabaseUrl', () => {
  it('returns DATABASE_URL as-is when it is set', () => {
    const env = {
      DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app',
      // DB_* も並存していても DATABASE_URL を優先
      DB_HOST: 'ignored',
      DB_USERNAME: 'ignored',
      DB_PASSWORD: 'ignored',
      DB_NAME: 'ignored',
    } as NodeJS.ProcessEnv;
    expect(resolveDatabaseUrl(env)).toBe('postgresql://u:p@db.example.com:5432/app');
  });

  it('falls back to constructing from DB_* when DATABASE_URL is empty', () => {
    const env = {
      DATABASE_URL: '',
      DB_HOST: 'rds.internal',
      DB_PORT: '5432',
      DB_USERNAME: 'komine_admin',
      DB_PASSWORD: 'secret',
      DB_NAME: 'komine_cemetery_crm',
    } as NodeJS.ProcessEnv;
    expect(resolveDatabaseUrl(env)).toBe(
      'postgresql://komine_admin:secret@rds.internal:5432/komine_cemetery_crm'
    );
  });

  it('constructs from DB_* when DATABASE_URL is absent', () => {
    const env = {
      DB_HOST: 'rds.internal',
      DB_PORT: '6543',
      DB_USERNAME: 'admin',
      DB_PASSWORD: 'pw',
      DB_NAME: 'app',
    } as NodeJS.ProcessEnv;
    expect(resolveDatabaseUrl(env)).toBe('postgresql://admin:pw@rds.internal:6543/app');
  });

  it('defaults the port to 5432 when DB_PORT is missing', () => {
    const env = {
      DB_HOST: 'rds.internal',
      DB_USERNAME: 'admin',
      DB_PASSWORD: 'pw',
      DB_NAME: 'app',
    } as NodeJS.ProcessEnv;
    expect(resolveDatabaseUrl(env)).toBe('postgresql://admin:pw@rds.internal:5432/app');
  });

  it('percent-encodes credentials that contain URL-breaking characters', () => {
    const env = {
      DB_HOST: 'rds.internal',
      DB_PORT: '5432',
      DB_USERNAME: 'komine_admin',
      // RDS 生成パスワードに混じり得る記号
      DB_PASSWORD: 'p@ss:w/rd?#%',
      DB_NAME: 'app',
    } as NodeJS.ProcessEnv;
    const url = resolveDatabaseUrl(env);
    expect(url).toBe(
      `postgresql://komine_admin:${encodeURIComponent('p@ss:w/rd?#%')}@rds.internal:5432/app`
    );
    // 生のパスワードがそのまま現れないこと（@ や / が未エンコードだと URL が壊れる）
    expect(url).not.toContain('p@ss:w/rd');
  });

  it('omits the password segment when DB_PASSWORD is empty', () => {
    const env = {
      DB_HOST: 'rds.internal',
      DB_PORT: '5432',
      DB_USERNAME: 'admin',
      DB_PASSWORD: '',
      DB_NAME: 'app',
    } as NodeJS.ProcessEnv;
    expect(resolveDatabaseUrl(env)).toBe('postgresql://admin@rds.internal:5432/app');
  });

  it('returns undefined when required DB_* values are missing', () => {
    expect(resolveDatabaseUrl({ DB_HOST: 'only-host' } as NodeJS.ProcessEnv)).toBeUndefined();
    expect(
      resolveDatabaseUrl({ DB_USERNAME: 'u', DB_NAME: 'd' } as NodeJS.ProcessEnv)
    ).toBeUndefined();
    expect(resolveDatabaseUrl({} as NodeJS.ProcessEnv)).toBeUndefined();
  });
});
