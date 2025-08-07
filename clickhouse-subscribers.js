import { createClient } from "@clickhouse/client";

// ClickHouse client configuration
const clickhouse = createClient({
  host: process.env.CH_MIGRATIONS_HOST,
  username: process.env.CH_MIGRATIONS_USER,
  password: process.env.CH_MIGRATIONS_PASSWORD,
  // database: process.env.CH_MIGRATIONS_DB,
});

class ClickHouseTableCreator {
  /**
   * Create the main subscribers table in ClickHouse
   */
  async createSubscribersTable() {
    try {
      console.log("Creating subscribers table in ClickHouse...");

      await clickhouse.exec({
        query: `
          CREATE TABLE IF NOT EXISTS subscribers (
            id String,
            store_id String,
            first_name String,
            last_name String,
            email String,
            phone String,
            country String,
            state String,
            city String,
            zip_code String,
            ip_address String,
            order_count UInt32,
            total_spend Decimal(12, 2),
            last_order_value Decimal(12, 2),
            last_order_date DateTime64(3),
            first_order_date DateTime64(3),
            average_order_value Decimal(10, 2),
            days_since_last_order Int32,
            custom_fields String,
            tags Array(String),
            is_email_optin UInt8,
            is_push_optin UInt8,
            is_sms_optin UInt8,
            is_active UInt8,
            unsubscribed_at DateTime64(3),
            last_seen_at DateTime64(3),
            time_zone String,
            preferred_language String,
            lifecycle_stage LowCardinality(String),
            customer_tier LowCardinality(String),
            created_at DateTime64(3),
            updated_at DateTime64(3),
            synced_at DateTime64(3) DEFAULT now()
          ) ENGINE = ReplacingMergeTree(updated_at)
          PARTITION BY toYYYYMM(created_at)
          ORDER BY (store_id, id)
          SETTINGS index_granularity = 8192
        `,
      });

      console.log("✅ Subscribers table created successfully");
    } catch (error) {
      console.error("❌ Failed to create subscribers table:", error);
      throw error;
    }
  }

  /**
   * Create materialized view for latest subscriber state (deduplication)
   */
  async createSubscribersLatestView() {
    try {
      console.log("Creating subscribers_latest materialized view...");

      await clickhouse.exec({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS subscribers_latest
          ENGINE = ReplacingMergeTree(updated_at)
          PARTITION BY toYYYYMM(created_at)
          ORDER BY (store_id, id)
          AS SELECT
            id,
            store_id,
            first_name,
            last_name,
            email,
            phone,
            country,
            state,
            city,
            zip_code,
            ip_address,
            order_count,
            total_spend,
            last_order_value,
            last_order_date,
            first_order_date,
            average_order_value,
            days_since_last_order,
            custom_fields,
            tags,
            is_email_optin,
            is_push_optin,
            is_sms_optin,
            is_active,
            unsubscribed_at,
            last_seen_at,
            time_zone,
            preferred_language,
            lifecycle_stage,
            customer_tier,
            created_at,
            updated_at,
            synced_at
          FROM subscribers
          FINAL
        `,
      });

      console.log("✅ Subscribers latest view created successfully");
    } catch (error) {
      console.error("❌ Failed to create subscribers latest view:", error);
      throw error;
    }
  }

  /**
   * Create aggregated views for analytics
   */
  async createSubscriberAggregationViews() {
    try {
      console.log("Creating subscriber aggregation views...");

      // Store-level subscriber metrics
      await clickhouse.exec({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS subscriber_metrics_by_store
          ENGINE = AggregatingMergeTree()
          PARTITION BY toYYYYMM(today())
          ORDER BY store_id
          AS SELECT
            store_id,
            count() as total_subscribers,
            countIf(is_active = 1) as active_subscribers,
            countIf(is_email_optin = 1) as email_opted_in,
            countIf(is_push_optin = 1) as push_opted_in,
            countIf(is_sms_optin = 1) as sms_opted_in,
            avg(total_spend) as avg_total_spend,
            sum(total_spend) as total_revenue,
            avg(order_count) as avg_order_count,
            countIf(lifecycle_stage = 'prospect') as prospects,
            countIf(lifecycle_stage = 'customer') as customers,
            countIf(lifecycle_stage = 'vip') as vip_customers,
            countIf(lifecycle_stage = 'churned') as churned_customers,
            countIf(customer_tier = 'bronze') as bronze_customers,
            countIf(customer_tier = 'silver') as silver_customers,
            countIf(customer_tier = 'gold') as gold_customers,
            countIf(customer_tier = 'platinum') as platinum_customers
          FROM subscribers
          WHERE is_active = 1
          GROUP BY store_id
        `,
      });

      // Geographic distribution
      await clickhouse.exec({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS subscriber_geographic_distribution
          ENGINE = AggregatingMergeTree()
          PARTITION BY toYYYYMM(today())
          ORDER BY (store_id, country, state)
          AS SELECT
            store_id,
            country,
            state,
            city,
            count() as subscriber_count,
            avg(total_spend) as avg_spend,
            countIf(is_email_optin = 1) as email_opted_count,
            countIf(is_push_optin = 1) as push_opted_count,
            countIf(is_sms_optin = 1) as sms_opted_count
          FROM subscribers
          WHERE is_active = 1 AND country != ''
          GROUP BY store_id, country, state, city
        `,
      });

      // Customer lifecycle metrics
      await clickhouse.exec({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS subscriber_lifecycle_metrics
          ENGINE = AggregatingMergeTree()
          PARTITION BY toYYYYMM(today())
          ORDER BY (store_id, lifecycle_stage, customer_tier)
          AS SELECT
            store_id,
            lifecycle_stage,
            customer_tier,
            count() as subscriber_count,
            avg(total_spend) as avg_total_spend,
            avg(order_count) as avg_order_count,
            avg(average_order_value) as avg_order_value,
            avg(days_since_last_order) as avg_days_since_last_order,
            countIf(is_email_optin = 1) as email_opted_count,
            countIf(is_push_optin = 1) as push_opted_count,
            countIf(is_sms_optin = 1) as sms_opted_count
          FROM subscribers
          WHERE is_active = 1
          GROUP BY store_id, lifecycle_stage, customer_tier
        `,
      });

      console.log("✅ Subscriber aggregation views created successfully");
    } catch (error) {
      console.error("❌ Failed to create subscriber aggregation views:", error);
      throw error;
    }
  }

  /**
   * Create indexes for better query performance
   */
  async createSubscriberIndexes() {
    try {
      console.log("Creating subscriber indexes...");

      // Index for email lookups
      await clickhouse.exec({
        query: `
          CREATE INDEX IF NOT EXISTS idx_subscribers_email 
          ON subscribers (email) 
          TYPE bloom_filter GRANULARITY 1
        `,
      });

      // Index for phone lookups
      await clickhouse.exec({
        query: `
          CREATE INDEX IF NOT EXISTS idx_subscribers_phone 
          ON subscribers (phone) 
          TYPE bloom_filter GRANULARITY 1
        `,
      });

      // Index for location-based queries
      await clickhouse.exec({
        query: `
          CREATE INDEX IF NOT EXISTS idx_subscribers_location 
          ON subscribers (country, state, city) 
          TYPE bloom_filter GRANULARITY 1
        `,
      });

      // Index for lifecycle and tier filtering
      await clickhouse.exec({
        query: `
          CREATE INDEX IF NOT EXISTS idx_subscribers_lifecycle 
          ON subscribers (lifecycle_stage, customer_tier) 
          TYPE bloom_filter GRANULARITY 1
        `,
      });

      // Index for active status filtering
      await clickhouse.exec({
        query: `
          CREATE INDEX IF NOT EXISTS idx_subscribers_active 
          ON subscribers (is_active) 
          TYPE bloom_filter GRANULARITY 1
        `,
      });

      console.log("✅ Subscriber indexes created successfully");
    } catch (error) {
      console.error("❌ Failed to create subscriber indexes:", error);
      throw error;
    }
  }

  /**
   * Create subscriber audit table for tracking changes
   */
  async createSubscriberAuditTable() {
    try {
      console.log("Creating subscriber audit table...");

      await clickhouse.exec({
        query: `
          CREATE TABLE IF NOT EXISTS subscriber_audit (
            id String,
            store_id String,
            subscriber_id String,
            operation LowCardinality(String), -- INSERT, UPDATE, DELETE
            changed_fields Array(String),
            old_values String, -- JSON
            new_values String, -- JSON
            changed_by String, -- user_id or system
            change_reason String,
            timestamp DateTime64(3) DEFAULT now(),
            date Date MATERIALIZED toDate(timestamp)
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(date)
          ORDER BY (store_id, subscriber_id, timestamp)
          SETTINGS index_granularity = 8192
        `,
      });

      console.log("✅ Subscriber audit table created successfully");
    } catch (error) {
      console.error("❌ Failed to create subscriber audit table:", error);
      throw error;
    }
  }

  /**
   * Create all subscriber-related tables and views
   */
  async createAllSubscriberTables() {
    try {
      console.log(
        "🚀 Creating all subscriber tables and views in ClickHouse..."
      );

      // Create tables in order
      await this.createSubscribersTable();
      // await this.createSubscribersLatestView();
      // await this.createSubscriberAggregationViews();
      await this.createSubscriberIndexes();
      await this.createSubscriberAuditTable();

      console.log("✅ All subscriber tables and views created successfully!");

      // Verify tables were created
      await this.verifyTablesCreated();
    } catch (error) {
      console.error("❌ Failed to create subscriber tables:", error);
      throw error;
    }
  }

  /**
   * Verify that all tables were created successfully
   */
  async verifyTablesCreated() {
    try {
      console.log("🔍 Verifying table creation...");

      const result = await clickhouse.query({
        query: `
          SELECT name, engine, total_rows 
          FROM system.tables 
          WHERE database = currentDatabase() 
          AND name LIKE '%subscriber%'
          ORDER BY name
        `,
        format: "JSONEachRow",
      });

      const tables = await result.json();

      console.log("📊 Created tables:");
      tables.forEach((table) => {
        console.log(
          `  - ${table.name} (${table.engine}) - ${table.total_rows} rows`
        );
      });

      // Check if all expected tables exist
      const expectedTables = [
        "subscribers",
        "subscribers_latest",
        "subscriber_metrics_by_store",
        "subscriber_geographic_distribution",
        "subscriber_lifecycle_metrics",
        "subscriber_audit",
      ];

      const createdTableNames = tables.map((t) => t.name);
      const missingTables = expectedTables.filter(
        (name) => !createdTableNames.includes(name)
      );

      if (missingTables.length > 0) {
        console.warn("⚠️ Missing tables:", missingTables);
      } else {
        console.log("✅ All subscriber tables verified successfully");
      }
    } catch (error) {
      console.error("❌ Failed to verify tables:", error);
      throw error;
    }
  }

  /**
   * Drop all subscriber tables (use with caution!)
   */
  async dropAllSubscriberTables() {
    try {
      console.log("🗑️ Dropping all subscriber tables...");

      const tablesToDrop = [
        "subscriber_lifecycle_metrics",
        "subscriber_geographic_distribution",
        "subscriber_metrics_by_store",
        "subscribers_latest",
        "subscriber_audit",
        "subscribers",
      ];

      for (const table of tablesToDrop) {
        try {
          await clickhouse.exec({
            query: `DROP TABLE IF EXISTS ${table}`,
          });
          console.log(`  - Dropped ${table}`);
        } catch (error) {
          console.warn(`  - Failed to drop ${table}:`, error.message);
        }
      }

      console.log("✅ All subscriber tables dropped");
    } catch (error) {
      console.error("❌ Failed to drop tables:", error);
      throw error;
    }
  }

  /**
   * Get table schema information
   */
  async getTableSchema(tableName) {
    try {
      const result = await clickhouse.query({
        query: `DESCRIBE TABLE ${tableName}`,
        format: "JSONEachRow",
      });

      return await result.json();
    } catch (error) {
      console.error(`Failed to get schema for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check table health and optimization status
   */
  async checkTableHealth() {
    try {
      console.log("🏥 Checking subscriber table health...");

      const result = await clickhouse.query({
        query: `
          SELECT 
            table,
            sum(rows) as total_rows,
            sum(bytes_on_disk) as total_size_bytes,
            round(total_size_bytes / 1024 / 1024, 2) as total_size_mb,
            count() as part_count,
            max(modification_time) as last_modified
          FROM system.parts 
          WHERE database = currentDatabase() 
          AND table LIKE '%subscriber%' 
          AND active = 1
          GROUP BY table
          ORDER BY total_rows DESC
        `,
        format: "JSONEachRow",
      });

      const health = await result.json();

      console.log("📊 Table Health Report:");
      health.forEach((table) => {
        console.log(`  ${table.table}:`);
        console.log(`    - Rows: ${table.total_rows.toLocaleString()}`);
        console.log(`    - Size: ${table.total_size_mb} MB`);
        console.log(`    - Parts: ${table.part_count}`);
        console.log(`    - Last Modified: ${table.last_modified}`);
      });

      // Check for tables that might need optimization
      const tablesNeedingOptimization = health.filter(
        (table) => table.part_count > 100
      );
      if (tablesNeedingOptimization.length > 0) {
        console.log("⚠️ Tables that might need optimization (>100 parts):");
        tablesNeedingOptimization.forEach((table) => {
          console.log(`  - ${table.table} (${table.part_count} parts)`);
        });
      }
    } catch (error) {
      console.error("❌ Failed to check table health:", error);
      throw error;
    }
  }

  /**
   * Optimize subscriber tables (merge parts)
   */
  async optimizeSubscriberTables() {
    try {
      console.log("⚡ Optimizing subscriber tables...");

      const tables = ["subscribers", "subscriber_audit"];

      for (const table of tables) {
        console.log(`  Optimizing ${table}...`);
        await clickhouse.exec({
          query: `OPTIMIZE TABLE ${table} FINAL`,
        });
        console.log(`  ✅ ${table} optimized`);
      }

      console.log("✅ All subscriber tables optimized");
    } catch (error) {
      console.error("❌ Failed to optimize tables:", error);
      throw error;
    }
  }

  async setupDevelopmentTables() {
    console.log("🛠️ Setting up development environment...");

    try {
      // Drop existing tables (development only!)
      if (process.env.NODE_ENV === "development") {
        await this.dropAllSubscriberTables();
      }

      // Create all tables
      await this.createAllSubscriberTables();

      console.log("✅ Development environment setup complete!");
    } catch (error) {
      console.error("❌ Development setup failed:", error);
      throw error;
    }
  }

  async addSubscribersBatch(subscribers) {
    if (subscribers.length === 0) return;

    try {
      const values = subscribers
        .map((subscriber) => {
          const formatted = this.formatSubscriberForClickHouse(subscriber);
          return `(
          ${formatted.id},
          ${formatted.store_id},
          ${formatted.first_name}, 
          ${formatted.last_name}, 
          ${formatted.email}, 
          ${formatted.phone},
          ${formatted.country}, 
          ${formatted.state}, 
          ${formatted.city}, 
          ${formatted.zip_code},
          ${formatted.order_count}, 
          ${formatted.total_spend}, 
          ${formatted.last_order_value},
          ${formatted.last_order_date}, 
          ${formatted.first_order_date}, 
          ${formatted.average_order_value}, 
          ${formatted.days_since_last_order},
          ${formatted.tags},
          ${formatted.is_email_optin}, 
          ${formatted.is_push_optin}, 
          ${formatted.is_sms_optin}, 
          ${formatted.is_active},
          ${formatted.unsubscribed_at}, 
          ${formatted.last_seen_at},
          ${formatted.time_zone}, 
          ${formatted.preferred_language},
          ${formatted.lifecycle_stage}, 
          ${formatted.customer_tier},
          ${formatted.created_at}, 
          ${formatted.updated_at}, 
          ${Date.now()}
        )`;
        })
        .join(",");

      await clickhouse.exec({
        query: `
          INSERT INTO subscribers (
            id, store_id, first_name, last_name, email, phone,
            country, state, city, zip_code, order_count, total_spend, last_order_value,
            last_order_date, first_order_date, average_order_value, days_since_last_order,
             tags, is_email_optin, is_push_optin, is_sms_optin, is_active,
            unsubscribed_at, last_seen_at, time_zone, preferred_language,
            lifecycle_stage, customer_tier, created_at, updated_at, synced_at
          ) VALUES ${values}
        `,
      });

      console.log(
        `Successfully added ${subscribers.length} subscribers to ClickHouse`
      );
    } catch (error) {
      console.error(
        `Failed to add batch of ${subscribers.length} subscribers to ClickHouse:`,
        error
      );
      throw error;
    }
  }

  formatSubscriberForClickHouse(subscriber) {
    const formatDate = (date) => {
      if (!date) return "toDateTime64('1970-01-01 00:00:00.000', 3)";

      // Format as YYYY-MM-DD HH:mm:ss.SSS
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

      const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
      return `toDateTime64('${formattedDate}', 3)`;
    };

    const formatString = (str) => {
      if (!str) return "";
      // Escape single quotes and backslashes for SQL safety
      return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    };

    const formatTags = (tags) => {
      if (!tags || tags.length === 0) return "[]";

      const escapedTags = tags.map((tag) => `'${formatString(tag)}'`);
      return `[${escapedTags.join(",")}]`;
    };

    const formatCustomFields = (fields) => {
      if (!fields || Object.keys(fields).length === 0) return "{}";

      try {
        return JSON.stringify(fields)
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'");
      } catch (error) {
        console.warn("Failed to stringify custom fields:", error);
        return "{}";
      }
    };

    const formatNullableDate = (date) => {
      return date
        ? formatDate(date)
        : "toDateTime64('1970-01-01 00:00:00.000', 3)";
    };

    const formatNullableString = (str) => {
      return str ? `'${formatString(str)}'` : "''";
    };

    const formatNullableNumber = (num) => {
      return num !== undefined && num !== null ? num : 0;
    };

    // Return values without extra quotes since they're already properly formatted
    return {
      id: `'${subscriber.id}'`,
      store_id: `'${subscriber.store_id}'`,
      first_name: formatNullableString(subscriber.first_name),
      last_name: formatNullableString(subscriber.last_name),
      email: formatNullableString(subscriber.email),
      phone: formatNullableString(subscriber.phone),
      country: formatNullableString(subscriber.country),
      state: formatNullableString(subscriber.state),
      city: formatNullableString(subscriber.city),
      zip_code: formatNullableString(subscriber.zip_code),
      ip_address: formatNullableString(""), // Add ip_address field
      order_count: formatNullableNumber(subscriber.order_count),
      total_spend: formatNullableNumber(subscriber.total_spend),
      last_order_value: formatNullableNumber(subscriber.last_order_value),
      last_order_date: formatNullableDate(subscriber.last_order_date),
      first_order_date: formatNullableDate(subscriber.first_order_date),
      average_order_value: formatNullableNumber(subscriber.average_order_value),
      days_since_last_order: formatNullableNumber(
        subscriber.days_since_last_order
      ),
      custom_fields: `'${formatCustomFields(subscriber.custom_fields)}'`,
      tags: formatTags(subscriber.tags),
      is_email_optin: subscriber.is_email_optin ? 1 : 0,
      is_push_optin: subscriber.is_push_optin ? 1 : 0,
      is_sms_optin: subscriber.is_sms_optin ? 1 : 0,
      is_active: subscriber.is_active ? 1 : 0,
      unsubscribed_at: formatNullableDate(subscriber.unsubscribed_at),
      last_seen_at: formatNullableDate(subscriber.last_seen_at),
      time_zone: formatNullableString(subscriber.time_zone),
      preferred_language: formatNullableString(subscriber.preferred_language),
      lifecycle_stage: formatNullableString(subscriber.lifecycle_stage),
      customer_tier: formatNullableString(subscriber.customer_tier),
      created_at: formatDate(subscriber.created_at),
      updated_at: formatDate(subscriber.updated_at),
    };
  }
}

export const clickHouseSubscriber = new ClickHouseTableCreator();
