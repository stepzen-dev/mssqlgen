import sql from 'mssql';
import { DatabaseConfig, TableInfo, ColumnInfo, ForeignKeyInfo } from '../types';

export class DatabaseConnector {
  private config: sql.config;
  private pool: sql.ConnectionPool | null = null;

  constructor(config: DatabaseConfig) {
    this.config = {
      server: config.server,
      database: config.database,
      user: config.user,
      password: config.password,
      port: config.port || 1433,
      options: {
        encrypt: config.options?.encrypt ?? true,
        trustServerCertificate: config.options?.trustServerCertificate ?? false,
        connectTimeout: config.options?.connectionTimeout ?? 30000,
        requestTimeout: config.options?.requestTimeout ?? 30000,
      },
    };
  }

  async connect(): Promise<void> {
    try {
      this.pool = await sql.connect(this.config);
      console.log('Successfully connected to database');
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('Disconnected from database');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      const result = await this.pool!.request().query('SELECT 1 as test');
      await this.disconnect();
      return result.recordset.length > 0;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getSchemas(): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const query = `
      SELECT DISTINCT SCHEMA_NAME
      FROM INFORMATION_SCHEMA.SCHEMATA
      WHERE SCHEMA_NAME NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner', 'db_accessadmin', 
                                 'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader',
                                 'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
      ORDER BY SCHEMA_NAME
    `;

    const result = await this.pool.request().query(query);
    return result.recordset.map((row: any) => row.SCHEMA_NAME);
  }

  async getTables(schemas?: string[]): Promise<Array<{ schema: string; table: string; fullName: string }>> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    let query = `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `;

    // Add schema filter if provided
    if (schemas && schemas.length > 0) {
      const schemaList = schemas.map(s => `'${s}'`).join(',');
      query += ` AND TABLE_SCHEMA IN (${schemaList})`;
    } else {
      // Exclude system schemas by default
      query += ` AND TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')`;
    }

    query += ` ORDER BY TABLE_SCHEMA, TABLE_NAME`;

    const result = await this.pool.request().query(query);

    return result.recordset.map((row: any) => ({
      schema: row.TABLE_SCHEMA,
      table: row.TABLE_NAME,
      fullName: `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`
    }));
  }

  async getTableInfo(tableName: string, schema: string = 'dbo'): Promise<TableInfo> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const columns = await this.getColumns(tableName, schema);
    const primaryKeys = await this.getPrimaryKeys(tableName, schema);
    const foreignKeys = await this.getForeignKeys(tableName, schema);

    // Mark primary key columns
    columns.forEach(col => {
      col.isPrimaryKey = primaryKeys.includes(col.name);
      col.isForeignKey = foreignKeys.some(fk => fk.columnName === col.name);
    });

    return {
      schema,
      name: tableName,
      columns,
      primaryKeys,
      foreignKeys,
    };
  }

  private async getColumns(tableName: string, schema: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT
        c.COLUMN_NAME as name,
        c.DATA_TYPE as dataType,
        c.IS_NULLABLE as isNullable,
        c.CHARACTER_MAXIMUM_LENGTH as maxLength,
        c.NUMERIC_PRECISION as precision,
        c.NUMERIC_SCALE as scale,
        c.COLUMN_DEFAULT as defaultValue,
        COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as isIdentity
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = @tableName
        AND c.TABLE_SCHEMA = @schema
      ORDER BY c.ORDINAL_POSITION
    `;

    const result = await this.pool!.request()
      .input('tableName', sql.VarChar, tableName)
      .input('schema', sql.VarChar, schema)
      .query(query);

    return result.recordset.map((row: any) => ({
      name: row.name,
      dataType: row.dataType,
      isNullable: row.isNullable === 'YES',
      maxLength: row.maxLength,
      precision: row.precision,
      scale: row.scale,
      defaultValue: row.defaultValue,
      isPrimaryKey: false, // Will be set later
      isForeignKey: false, // Will be set later
      isIdentity: row.isIdentity === 1,
    }));
  }

  private async getPrimaryKeys(tableName: string, schema: string): Promise<string[]> {
    const query = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
        AND TABLE_NAME = @tableName
        AND TABLE_SCHEMA = @schema
      ORDER BY ORDINAL_POSITION
    `;

    const result = await this.pool!.request()
      .input('tableName', sql.VarChar, tableName)
      .input('schema', sql.VarChar, schema)
      .query(query);

    return result.recordset.map((row: any) => row.COLUMN_NAME);
  }

  private async getForeignKeys(tableName: string, schema: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT
        fk.name as constraintName,
        c.name as columnName,
        rs.name as referencedSchema,
        rt.name as referencedTable,
        rc.name as referencedColumn
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables t ON fkc.parent_object_id = t.object_id
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
      INNER JOIN sys.tables rt ON fkc.referenced_object_id = rt.object_id
      INNER JOIN sys.schemas rs ON rt.schema_id = rs.schema_id
      INNER JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
      WHERE t.name = @tableName
        AND s.name = @schema
    `;

    const result = await this.pool!.request()
      .input('tableName', sql.VarChar, tableName)
      .input('schema', sql.VarChar, schema)
      .query(query);

    return result.recordset.map((row: any) => ({
      constraintName: row.constraintName,
      columnName: row.columnName,
      referencedSchema: row.referencedSchema,
      referencedTable: row.referencedTable,
      referencedColumn: row.referencedColumn,
    }));
  }
}
