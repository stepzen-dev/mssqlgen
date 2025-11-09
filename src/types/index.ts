export interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    connectionTimeout?: number;
    requestTimeout?: number;
  };
}

export interface GenerationConfig {
  outputDir: string;
  tables?: string[];  // Simple array of schema.table patterns with wildcard support
  naming?: {
    typePrefix?: string;
    typeSuffix?: string;
    fieldCase?: 'camelCase' | 'snake_case' | 'PascalCase';
  };
  features?: {
    generateMutations?: boolean;
    generateRelationships?: boolean;
    autoIncludeForeignKeyTables?: boolean;
    filtering?: {
      enabled?: boolean;
      tables?: string[];
      operators?: string[];
      enableLogicalOps?: boolean;
      useShorthands?: boolean;
    };
    pagination?: {
      enabled?: boolean;
      defaultPageSize?: number;
      tables?: string[];
    };
  };
}

export interface Config {
  database: DatabaseConfig;
  generation: GenerationConfig;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isIdentity: boolean;
}

export interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
}

export interface DatabaseSchema {
  tables: TableInfo[];
}

export interface GraphQLField {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export interface GraphQLType {
  name: string;
  fields: GraphQLField[];
  description?: string;
}

export interface GraphQLQuery {
  name: string;
  returnType: string;
  arguments: Array<{ name: string; type: string; required: boolean }>;
  dbQuery: string;
}

export interface StepZenSchema {
  types: GraphQLType[];
  queries: GraphQLQuery[];
}
