// // Types for the segmentation payload
// interface SegmentCondition {
//   field: string;
//   operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' |
//            'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' |
//            'is_null' | 'is_not_null' | 'between' | 'regex' | 'has_any' | 'has_all';
//   value: any;
//   value2?: any; // For 'between' operator
// }

// interface SegmentGroup {
//   logic: 'AND' | 'OR';
//   conditions: SegmentCondition[];
//   groups?: SegmentGroup[]; // Nested groups for complex logic
// }

// interface EventFilter {
//   table: 'pixel_events' | 'analytics';
//   timeframe?: {
//     start?: string; // ISO date string
//     end?: string;
//     relative?: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_year' | 'this_month' | 'last_month';
//   };
//   conditions: SegmentGroup;
//   aggregation?: {
//     type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct_count';
//     field?: string; // Required for sum, avg, min, max
//     having?: SegmentCondition; // Conditions on aggregated results
//   };
// }

// interface SegmentationPayload {
//   store_id: string;
//   name: string;
//   description?: string;
//   base_conditions?: SegmentGroup; // Conditions on subscribers table
//   event_filters?: EventFilter[]; // Array of event-based filters
//   limit?: number;
//   offset?: number;
//   return_count_only?: boolean;
// }

// Field mappings for validation and SQL generation
const FIELD_MAPPINGS = {
  subscribers: {
    id: "String",
    store_id: "String",
    first_name: "String",
    last_name: "String",
    email: "String",
    phone: "String",
    country: "String",
    state: "String",
    city: "String",
    zip_code: "String",
    order_count: "UInt32",
    total_spend: "Decimal",
    last_order_value: "Decimal",
    last_order_date: "DateTime64",
    first_order_date: "DateTime64",
    average_order_value: "Decimal",
    days_since_last_order: "Int32",
    tags: "Array(String)",
    is_email_optin: "UInt8",
    is_push_optin: "UInt8",
    is_sms_optin: "UInt8",
    is_active: "UInt8",
    lifecycle_stage: "String",
    customer_tier: "String",
    created_at: "DateTime64",
    updated_at: "DateTime64",
  },
  pixel_events: {
    id: "String",
    store_id: "String",
    subscriber_id: "String",
    session_id: "String",
    event_type: "String",
    event_name: "String",
    page_url: "String",
    referrer_url: "String",
    device_type: "String",
    browser: "String",
    operating_system: "String",
    utm_source: "String",
    utm_medium: "String",
    utm_campaign: "String",
    product_id: "String",
    category: "String",
    product_name: "String",
    product_price: "Float64",
    currency: "String",
    quantity: "Int32",
    cart_value: "Float64",
    order_id: "String",
    revenue: "Float64",
    timestamp: "DateTime64",
    date: "Date",
  },
  analytics: {
    id: "String",
    store_id: "String",
    subscriber_id: "String",
    campaign_id: "String",
    message_id: "String",
    channel: "String",
    event_type: "String",
    subject: "String",
    content_type: "String",
    template_id: "String",
    link_url: "String",
    device_type: "String",
    client: "String",
    operating_system: "String",
    location_country: "String",
    location_region: "String",
    location_city: "String",
    engagement_score: "Float32",
    time_to_open: "Int32",
    time_to_click: "Int32",
    bounce_category: "String",
    timestamp: "DateTime64",
    date: "Date",
  },
};

class SegmentationQueryBuilder {
  constructor({ debug = false } = {}) {
    this.debug = debug;
  }

  escapeValue(value, fieldType) {
    if (value === null || value === undefined) return "NULL";
    
    if (fieldType.includes("Array")) {
      const arr = Array.isArray(value) ? value : [value];
      return `[${arr.map((v) => this.escapeValue(v, "String")).join(", ")}]`;
    }
    if (fieldType.includes("String") || fieldType.includes("Date")) {
      return `'${String(value).replace(/'/g, "''")}'`;
    }


    return String(value);
  }

  escapeIdentifier(field) {
    return `\`${field.replace(/`/g, "``")}\``;
  }

  buildCondition(condition, table, isAggregate = false) {
    const { field, operator, value, value2 } = condition;
    const fieldType = FIELD_MAPPINGS[table]?.[field] || "String";
    const escapedField = isAggregate ? field : this.escapeIdentifier(field);
    console.log("inside build condition", {
      escapedField,
      fieldType,
      value,
      value2,
      operator,
    });
    
    switch (operator) {
      case "equals":
        return `${escapedField} = ${this.escapeValue(value, fieldType)}`;
      case "not_equals":
        return `${escapedField} != ${this.escapeValue(value, fieldType)}`;
      case "greater_than":
        return `${escapedField} > ${this.escapeValue(value, fieldType)}`;
      case "less_than":
        return `${escapedField} < ${this.escapeValue(value, fieldType)}`;
      case "greater_equal":
        return `${escapedField} >= ${this.escapeValue(value, fieldType)}`;
      case "less_equal":
        return `${escapedField} <= ${this.escapeValue(value, fieldType)}`;
      case "contains":
        return `${escapedField} LIKE '%${String(value).replace(/'/g, "''")}%'`;
      case "not_contains":
        return `${escapedField} NOT LIKE '%${String(value).replace(/'/g, "''")}%'`;
      case "starts_with":
        return `${escapedField} LIKE '${String(value).replace(/'/g, "''")}%'`;
      case "ends_with":
        return `${escapedField} LIKE '%${String(value).replace(/'/g, "''")}'`;
      case "in":
        return `${escapedField} IN (${(Array.isArray(value) ? value : [value])
          .map((v) => this.escapeValue(v, fieldType))
          .join(", ")})`;
      case "not_in":
        return `${escapedField} NOT IN (${(Array.isArray(value) ? value : [value])
          .map((v) => this.escapeValue(v, fieldType))
          .join(", ")})`;
      case "is_null":
        return `${escapedField} IS NULL`;
      case "is_not_null":
        return `${escapedField} IS NOT NULL`;
      case "between":
        return `${escapedField} BETWEEN ${this.escapeValue(value, fieldType)} AND ${this.escapeValue(value2, fieldType)}`;
      case "regex":
        return `match(${escapedField}, ${this.escapeValue(value, fieldType)}) = 1`;
      case "has_any":
        return `hasAny(${escapedField}, ${this.escapeValue(value, fieldType)})`;
      case "has_all":
        return `hasAll(${escapedField}, ${this.escapeValue(value, fieldType)})`;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  buildGroup(group, table) {
    const conditions = group.conditions?.map((cond) => this.buildCondition(cond, table)) || [];
    const nestedGroups = group.groups?.map((g) => `(${this.buildGroup(g, table)})`) || [];
    const all = [...conditions, ...nestedGroups];
    console.log("conditions", conditions);
    console.log("nestedGroups", nestedGroups);
    console.log("all", all);
    
    if (all.length === 0) return "";
    if (all.length === 1) return all[0];

    return all.join(` ${group.logic || "AND"} `);
  }

  buildTimeframe(timeframe) {
    if (!timeframe) return "";

    if (timeframe.start || timeframe.end) {
      const parts = [];
      if (timeframe.start) parts.push(`timestamp >= '${timeframe.start}'`);
      if (timeframe.end) parts.push(`timestamp <= '${timeframe.end}'`);
      return parts.join(" AND ");
    }

    const map = {
      last_7_days: `timestamp >= now() - toIntervalDay(7)`,
      last_30_days: `timestamp >= now() - toIntervalDay(30)`,
      last_90_days: `timestamp >= now() - toIntervalDay(90)`,
      last_year: `timestamp >= now() - toIntervalYear(1)`,
      this_month: `timestamp >= toStartOfMonth(now())`,
      last_month: `timestamp >= toStartOfMonth(now() - toIntervalMonth(1)) AND timestamp < toStartOfMonth(now())`,
    };

    return map[timeframe.relative] || "";
  }

  buildEventFilter(filter, storeId) {
    const { table, timeframe, conditions, aggregation, exclude } = filter;

    let subquery = `SELECT subscriber_id FROM ${this.escapeIdentifier(table)} WHERE store_id = '${storeId.replace(/'/g, "''")}'`;

    const timeframeSql = this.buildTimeframe(timeframe);
    console.log("timeframe sql => ", timeframeSql);
    
    if (timeframeSql) subquery += ` AND ${timeframeSql}`;

    const conditionsSql = this.buildGroup(conditions, table);
    if (conditionsSql) subquery += ` AND ${conditionsSql}`;

    if (aggregation) {
      const { type, field, having } = aggregation;
      subquery += ` GROUP BY subscriber_id`;

      if (having) {
        const aggregateField = field || "*";
        const func = type === "distinct_count" ? "uniq" : "count";
        const havingCondition = this.buildCondition(
          { ...having, field: `${func}(${aggregateField})` },
          table,
          true
        );
        subquery += ` HAVING ${havingCondition}`;
      }
    }

    const operator = exclude ? "NOT IN" : "IN";
    return `s.id ${operator} (${subquery})`;
  }

  buildSegmentationQuery(payload) {
    const {
      store_id,
      base_conditions,
      event_filters,
      limit,
      offset,
      return_count_only,
    } = payload;

    let query = return_count_only ? "SELECT count(*) as total" : "SELECT *";
    query += " FROM subscribers s";
    query += ` WHERE s.store_id = '${store_id.replace(/'/g, "''")}'`;

    if (base_conditions) {
      const baseSql = this.buildGroup(base_conditions, "subscribers");
      console.log("base sql is => ", baseSql);
      
      if (baseSql) query += ` AND ${baseSql}`;
    }

    if (event_filters?.length) {
      for (const ef of event_filters) {
        const filterSql = this.buildEventFilter(ef, store_id);
        query += ` AND ${filterSql}`;
      }
    }

    if (!return_count_only) {
      query += " ORDER BY s.updated_at DESC";
      if (limit) query += ` LIMIT ${limit}`;
      if (offset) query += ` OFFSET ${offset}`;
    }

    if (this.debug) console.log("[Segmentation SQL]", query);

    return query;
  }
}

// Usage examples
const segmentationBuilder = new SegmentationQueryBuilder({debug: true});

// Example 1: High-value customers who made purchases in last 30 days




import { clickhouse } from "./clickhouse-client.js";
import { ecommerceSegment1, ecommerceSegment2, ecommerceSegment4, ecommerceSegment5, klaviyoCondition1, klaviyoCondition2, klaviyoCondition3, klaviyoCondition4, klaviyoCondition5, klaviyoCondition6, klaviyoCondition7, klaviyoCondition8, testPayload1, testPayload2, testPayload3, testPayload4, testPayload5 } from "./test-queries.js";

try {

  const result = await clickhouse.query({
    query: segmentationBuilder.buildSegmentationQuery(klaviyoCondition8),
    format: "JSONEachRow",
  });

  const count = await clickhouse.query({
    query: segmentationBuilder.buildSegmentationQuery({
      ...ecommerceSegment5,
      return_count_only: true,
    }),
    format: "JSONEachRow",
  });

  const countResult = await count.json();
  const data = await result.json();
  console.log(data);
  console.log("Count Result:", countResult[0].total);
} catch (error) {
  console.error(error);
}
