import { TableInfo } from '../types';
import { TypeMapper } from '../utils/type-mapper';

export interface FilterConfig {
  operators: string[];
  enableLogicalOps: boolean;
  useShorthands: boolean;
}

export class FilterGenerator {
  /**
   * Generates shared filter input types (IntFilter, StringFilter, etc.)
   */
  generateSharedFilterTypes(config: FilterConfig): string {
    let content = '# Shared Filter Input Types\n\n';

    const typeFilters = [
      { name: 'Int', graphqlType: 'Int', allowedOps: ['eq', 'ne', 'lt', 'gt', 'le', 'ge'] },
      { name: 'Float', graphqlType: 'Float', allowedOps: ['eq', 'ne', 'lt', 'gt', 'le', 'ge'] },
      { name: 'String', graphqlType: 'String', allowedOps: ['eq', 'ne', 'lt', 'gt', 'le', 'ge', 'like', 'ilike'] },
      { name: 'Boolean', graphqlType: 'Boolean', allowedOps: ['eq', 'ne'] },
      { name: 'ID', graphqlType: 'ID', allowedOps: ['eq', 'ne', 'lt', 'gt', 'le', 'ge', 'like', 'ilike'] },
    ];

    typeFilters.forEach(({ name, graphqlType, allowedOps }) => {
      content += `input ${name}Filter {\n`;
      
      // Only include operators that are both configured AND allowed for this type
      config.operators
        .filter(op => allowedOps.includes(op))
        .forEach(op => {
          content += `  ${op}: ${graphqlType}\n`;
        });
      
      content += '}\n\n';
    });

    return content;
  }

  /**
   * Generates table-specific filter input type
   */
  generateTableFilterType(
    table: TableInfo,
    config: FilterConfig
  ): string {
    const typeName = TypeMapper.toPascalCase(table.name);
    const filterTypeName = `${typeName}Filter`;
    
    let content = `input ${filterTypeName} {\n`;

    // Add field filters
    table.columns.forEach(column => {
      const fieldName = TypeMapper.toCamelCase(column.name);
      const graphqlType = TypeMapper.mapType(column.dataType);
      
      // Use shorthand for String/ID if enabled
      if (config.useShorthands && (graphqlType === 'String' || graphqlType === 'ID')) {
        content += `  ${fieldName}: ${graphqlType}\n`;
      } else {
        // Use filter type
        const filterType = this.getFilterTypeForGraphQLType(graphqlType);
        if (filterType) {
          content += `  ${fieldName}: ${filterType}\n`;
        }
      }
    });

    // Add logical operators if enabled
    if (config.enableLogicalOps) {
      content += `\n  and: ${filterTypeName}\n`;
      content += `  or: ${filterTypeName}\n`;
    }

    content += '}\n';

    return content;
  }

  /**
   * Maps GraphQL type to its filter type
   */
  private getFilterTypeForGraphQLType(graphqlType: string): string | null {
    // Remove ! for non-null types
    const baseType = graphqlType.replace('!', '');
    
    switch (baseType) {
      case 'Int':
        return 'IntFilter';
      case 'Float':
        return 'FloatFilter';
      case 'String':
        return 'StringFilter';
      case 'Boolean':
        return 'BooleanFilter';
      case 'ID':
        return 'IDFilter';
      default:
        return null;
    }
  }

  /**
   * Checks if a table should have filtering enabled
   */
  shouldEnableFiltering(
    tableName: string,
    filterTables: string[]
  ): boolean {
    if (filterTables.length === 0) {
      return true; // Enable for all if no specific tables listed
    }

    return filterTables.some(pattern => this.matchPattern(tableName, pattern));
  }

  /**
   * Simple pattern matching with wildcards
   */
  private matchPattern(str: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(str);
  }
}
