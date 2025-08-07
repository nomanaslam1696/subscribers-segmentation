import dotenv from "dotenv";
dotenv.config();
import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";
import { clickHouseSubscriber } from "./clickhouse-subscribers.js";
import { clickhouse } from "./clickhouse-client.js";

const prisma = new PrismaClient();

const defaultConfig = {
  stores: 10,
  subscribersPerStore: 8_000,
  segmentsPerStore: 5,
  pixelEventsPerSubscriber: 5,
  analyticsEventsPerSubscriber: 10,
  daysOfHistory: 90,
};

class ClickHouseSeeder {
  constructor() {
    this.storeIds = [];
    this.subscriberIds = [];
    this.segmentIds = [];
    this.config = defaultConfig;
  }

  async seed(config = defaultConfig) {
    console.log("🌱 Starting database seeding...");
    console.log(`Configuration:`, config);

    try {
      // Initialize ClickHouse tables
      await this.initializeClickHouseTables();

      // Clean existing data
      await this.cleanDatabase();

      // Generate store IDs
      this.storeIds = Array.from(
        { length: config.stores },
        (_, idx) => `store-${idx + 1}`
      );

      // Seed PostgreSQL data (subscribers, segments)
      await this.seedSubscribers(config);
      await this.seedSegments(config);
      await this.seedSegmentSubscribers(config);

      console.log("✅ Database seeding completed successfully!");
      await this.printSeedingSummary();
    } catch (error) {
      console.error("❌ Seeding failed:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
      await clickhouse.close();
    }
  }

  async initializeClickHouseTables() {
    console.log("🏗️ Initializing ClickHouse tables...");

    await clickhouse.exec({
      query: `
      CREATE DATABASE IF NOT EXISTS segmentation;
      `,
    });

    await clickHouseSubscriber.setupDevelopmentTables();

    // Create pixel_events table
    await clickhouse.exec({
      query: `
        CREATE TABLE IF NOT EXISTS pixel_events (
          id String,
          store_id String,
          subscriber_id String,
          session_id String,
          event_type LowCardinality(String),
          event_name String,
          page_url String,
          referrer_url String,
          user_agent String,
          ip_address String,
          device_type LowCardinality(String),
          browser LowCardinality(String),
          operating_system LowCardinality(String),
          screen_resolution String,
          viewport_size String,
          utm_source String,
          utm_medium String,
          utm_campaign String,
          utm_term String,
          utm_content String,
          product_id String,
          category String,
          product_name String,
          product_price Float64,
          currency LowCardinality(String),
          quantity Int32,
          cart_value Float64,
          order_id String,
          revenue Float64,
          custom_properties String,
          timestamp DateTime64(3),
          date Date MATERIALIZED toDate(timestamp),
          hour Int8 MATERIALIZED toHour(timestamp)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (store_id, subscriber_id, timestamp)
        SETTINGS index_granularity = 8192
      `,
    });

    // Create analytics table
    await clickhouse.exec({
      query: `
        CREATE TABLE IF NOT EXISTS analytics (
          id String,
          store_id String,
          subscriber_id String,
          campaign_id String,
          message_id String,
          channel LowCardinality(String),
          event_type LowCardinality(String),
          subject String,
          content_type LowCardinality(String),
          template_id String,
          link_url String,
          link_text String,
          position Int32,
          device_type LowCardinality(String),
          client LowCardinality(String),
          operating_system LowCardinality(String),
          ip_address String,
          user_agent String,
          location_country String,
          location_region String,
          location_city String,
          engagement_score Float32,
          time_to_open Int32,
          time_to_click Int32,
          bounce_category LowCardinality(String),
          unsubscribe_reason String,
          custom_attributes String,
          timestamp DateTime64(3),
          date Date MATERIALIZED toDate(timestamp),
          hour Int8 MATERIALIZED toHour(timestamp)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (store_id, subscriber_id, channel, timestamp)
        SETTINGS index_granularity = 8192
      `,
    });

    // Create materialized views for aggregations
    await clickhouse.exec({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS pixel_events_hourly
        ENGINE = SummingMergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (store_id, event_type, date, hour)
        AS SELECT
          store_id,
          event_type,
          date,
          hour,
          count() as event_count,
          uniq(subscriber_id) as unique_subscribers,
          sum(revenue) as total_revenue
        FROM pixel_events
        GROUP BY store_id, event_type, date, hour
      `,
    });

    await clickhouse.exec({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_summary
        ENGINE = SummingMergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (store_id, channel, event_type, date)
        AS SELECT
          store_id,
          channel,
          event_type,
          date,
          count() as event_count,
          uniq(subscriber_id) as unique_subscribers,
          avg(engagement_score) as avg_engagement_score
        FROM analytics
        GROUP BY store_id, channel, event_type, date
      `,
    });

    console.log("✅ ClickHouse tables initialized");
  }

  async cleanDatabase() {
    console.log("🧹 Cleaning existing data...");

    // Clean ClickHouse
    await clickhouse.exec({ query: "TRUNCATE TABLE pixel_events" });
    await clickhouse.exec({ query: "TRUNCATE TABLE analytics" });
    await clickhouse.exec({ query: "TRUNCATE TABLE subscribers" });
    // Clean PostgreSQL
    await prisma.segmentSubscriber.deleteMany();
    await prisma.segment.deleteMany();
    await prisma.subscriber.deleteMany();

    console.log("✨ Database cleaned");
  }

  async seedSubscribers(config) {
    console.log("👥 Seeding subscribers...");

    const batchSize = 1000;
    let totalCreated = 0;

    for (const storeId of this.storeIds) {
      const totalSubscribers = config.subscribersPerStore;

      for (let i = 0; i < totalSubscribers; i += batchSize) {
        const currentBatchSize = Math.min(batchSize, totalSubscribers - i);
        const subscribers = Array.from({ length: currentBatchSize }, () =>
          this.generateSubscriber(storeId)
        );
         await prisma.subscriber.createMany({
          data: subscribers,
          skipDuplicates: true,
        });
        // console.log(subscribers);
        await clickHouseSubscriber.addSubscribersBatch(subscribers);
        await this.seedPixelEvents(subscribers);
        await this.seedAnalyticsEvents(subscribers);

        totalCreated += currentBatchSize;

        if (totalCreated % 5000 === 0) {
          console.log(`  📊 Created ${totalCreated} subscribers...`);
        }
      }

      // Store subscriber IDs for this store
      const storeSubscribers = await prisma.subscriber.findMany({
        where: { store_id: storeId },
        select: { id: true },
      });
      this.subscriberIds.push(...storeSubscribers.map((s) => s.id));
    }

    console.log(
      `✅ Created ${totalCreated} subscribers across ${config.stores} stores`
    );
  }

  generateSubscriber(storeId) {
    const createdAt = faker.date.between({
      from: "2022-01-01T00:00:00.000Z",
      to: new Date(),
    });

    const hasOrders = faker.datatype.boolean({ probability: 0.7 });
    const orderCount = hasOrders ? faker.number.int({ min: 1, max: 50 }) : 0;
    const totalSpend =
      orderCount > 0
        ? faker.number.float({ min: 25, max: 5000, fractionDigits: 2 })
        : 0;

    const lastOrderDate =
      orderCount > 0
        ? faker.date.between({ from: createdAt, to: new Date() })
        : null;

    return {
      id: faker.string.uuid(),
      store_id: storeId,
      platform_id: faker.helpers.maybe(() => faker.string.alphanumeric(10), {
        probability: 0.8,
      }),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      push_subscription_token: faker.helpers.maybe(
        () => ({
          endpoint: faker.internet.url(),
          keys: {
            p256dh: faker.string.alphanumeric(87),
            auth: faker.string.alphanumeric(22),
          },
        }),
        { probability: 0.4 }
      ),
      phone: faker.helpers.maybe(() => faker.phone.number(), {
        probability: 0.6,
      }),
      country: faker.location.country(),
      state: faker.location.state(),
      city: faker.location.city(),
      zip_code: faker.location.zipCode(),
      ip_address: faker.internet.ip(),
      order_count: orderCount,
      total_spend: totalSpend,
      last_order_value:
        orderCount > 0
          ? faker.number.float({ min: 10, max: 500, fractionDigits: 2 })
          : 0,
      last_order_date: lastOrderDate,
      custom_fields: faker.helpers.maybe(
        () => ({
          source: faker.helpers.arrayElement([
            "organic",
            "paid",
            "referral",
            "social",
          ]),
          utm_campaign: faker.lorem.word(),
          referrer: faker.internet.url(),
        }),
        { probability: 0.5 }
      ),
      tags: faker.helpers.arrayElements(
        [
          "vip",
          "new-customer",
          "high-value",
          "at-risk",
          "seasonal-buyer",
          "mobile-user",
          "newsletter-subscriber",
          "sale-hunter",
          "loyal",
        ],
        { min: 0, max: 4 }
      ),
      is_email_optin: faker.datatype.boolean({ probability: 0.85 }),
      is_push_optin: faker.datatype.boolean({ probability: 0.35 }),
      is_sms_optin: faker.datatype.boolean({ probability: 0.25 }),
      created_at: createdAt,
      updated_at: faker.date.between({ from: createdAt, to: new Date() }),
    };
  }

  async seedSegments(config) {
    console.log("📊 Seeding segments...");

    const segments = [];

    for (const storeId of this.storeIds) {
      // Create default segments
      segments.push(...this.createDefaultSegments(storeId));

      // Create custom segments
      for (let i = 0; i < config.segmentsPerStore - 5; i++) {
        segments.push(this.generateCustomSegment(storeId));
      }
    }

    await prisma.segment.createMany({
      data: segments,
      skipDuplicates: true,
    });

    const createdSegments = await prisma.segment.findMany({
      select: { id: true },
    });
    this.segmentIds = createdSegments.map((s) => s.id);

    console.log(`✅ Created ${segments.length} segments`);
  }

  createDefaultSegments(storeId) {
    return [
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "All Subscribers",
        description: "All active subscribers",
        is_default: true,
        query: "SELECT * FROM subscribers WHERE is_active = true",
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "VIP Customers",
        description: "High-value customers",
        query: "SELECT * FROM subscribers WHERE total_spend > 1000",
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "Recent Visitors",
        description: "Users who visited in last 7 days",
        query:
          "SELECT DISTINCT subscriber_id FROM pixel_events WHERE timestamp >= now() - INTERVAL 7 DAY",
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "Email Engaged",
        description: "High email engagement users",
        query:
          "SELECT DISTINCT subscriber_id FROM analytics WHERE channel = 'email' AND event_type IN ('opened', 'clicked')",
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "Cart Abandoners",
        description: "Users who added to cart but didn't purchase",
        query:
          "SELECT DISTINCT subscriber_id FROM pixel_events WHERE event_type = 'add_to_cart' AND subscriber_id NOT IN (SELECT subscriber_id FROM pixel_events WHERE event_type = 'purchase')",
      },
    ];
  }

  generateCustomSegment(storeId) {
    return {
      id: faker.string.uuid(),
      store_id: storeId,
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
      query: faker.lorem.sentence(),
    };
  }

  async seedSegmentSubscribers(config) {
    console.log("🔗 Seeding segment-subscriber relationships...");

    let totalCreated = 0;

    for (const storeId of this.storeIds) {
      const storeSegments = await prisma.segment.findMany({
        where: { store_id: storeId },
        select: { id: true, name: true },
      });

      const storeSubscribers = await prisma.subscriber.findMany({
        where: { store_id: storeId },
        select: { id: true },
      });

      for (const segment of storeSegments) {
        let subscribersToAdd;

        if (segment.name === "All Subscribers") {
          subscribersToAdd = storeSubscribers;
        } else {
          const percentage = faker.number.float({ min: 0.05, max: 0.4 });
          const count = Math.floor(storeSubscribers.length * percentage);
          subscribersToAdd = faker.helpers.arrayElements(
            storeSubscribers,
            count
          );
        }

        const segmentSubscribers = subscribersToAdd.map((subscriber) => ({
          id: faker.string.uuid(),
          segment_id: segment.id,
          subscriber_id: subscriber.id,
        }));

        await prisma.segmentSubscriber.createMany({
          data: segmentSubscribers,
          skipDuplicates: true,
        });

        totalCreated += segmentSubscribers.length;

        // Update segment count
        await prisma.segment.update({
          where: { id: segment.id },
          data: { subscriber_count: subscribersToAdd.length },
        });
      }
    }

    console.log(`✅ Created ${totalCreated} segment-subscriber relationships`);
  }

  async seedPixelEvents(subscribers) {
    console.log("🎯 Seeding pixel events in ClickHouse...");

    const eventTypes = [
      "page_view",
      "session_start",
      "session_end",
      "product_view",
      "add_to_cart",
      "remove_from_cart",
      "checkout_start",
      "checkout_complete",
      "purchase",
      "search",
      "category_view",
      "wishlist_add",
    ];

    const deviceTypes = ["mobile", "desktop", "tablet"];
    const browsers = ["Chrome", "Safari", "Firefox", "Edge", "Opera"];
    const operatingSystems = ["Windows", "macOS", "iOS", "Android", "Linux"];
    const currencies = ["USD", "EUR", "GBP", "CAD", "AUD"];

    const batchSize = 10000;
    let totalEvents = 0;
    const subscriberIds = subscribers.map((sub) => sub.id);
    // console.log(subscriberIds);
    // // Sample 30% of subscribers for pixel events
    const subscriberSample = faker.helpers.arrayElements(
      subscriberIds,
      Math.floor(subscriberIds.length * 0.3)
    );
    // console.log(subscriberSample);
    console.log(
      `  📊 Generating events for ${subscriberSample.length} subscribers...`
    );

    const allEvents = [];

    for (const subscriberId of subscriberSample) {
      const subscriber = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: { store_id: true, created_at: true, country: true },
      });

      if (!subscriber) continue;

      const eventsCount = faker.number.int({
        min: this.config.pixelEventsPerSubscriber * 0.5,
        max: this.config.pixelEventsPerSubscriber * 1.5,
      });

      // Generate realistic session-based events
      const sessions = this.generateSessions(eventsCount);

      for (const session of sessions) {
        const sessionId = faker.string.uuid();
        const deviceType = faker.helpers.arrayElement(deviceTypes);
        const browser = faker.helpers.arrayElement(browsers);
        const os = faker.helpers.arrayElement(operatingSystems);
        const userAgent = faker.internet.userAgent();
        const ipAddress = faker.internet.ip();

        for (const event of session.events) {
          const eventData = this.generatePixelEvent({
            subscriberId,
            storeId: subscriber.store_id,
            sessionId,
            eventType: event.type,
            timestamp: event.timestamp,
            deviceType,
            browser,
            os,
            userAgent,
            ipAddress,
            country: subscriber.country,
            currencies,
          });

          allEvents.push(eventData);
        }
      }
    }

    // Insert events in batches
    for (let i = 0; i < allEvents.length; i += batchSize) {
      const batch = allEvents.slice(i, i + batchSize);

      const values = batch
        .map((event) => {
          const timestamp = event.timestamp
            .toISOString()
            .replace("T", " ")
            .replace("Z", "");
          return `(
          '${event.id}', '${event.store_id}', '${event.subscriber_id}', '${event.session_id}',
          '${event.event_type}', '${event.event_name}', '${event.page_url}', '${event.referrer_url}',
          '${event.user_agent}', '${event.ip_address}', '${event.device_type}', '${event.browser}',
          '${event.operating_system}', '${event.screen_resolution}', '${event.viewport_size}',
          '${event.utm_source}', '${event.utm_medium}', '${event.utm_campaign}', '${event.utm_term}', '${event.utm_content}',
          '${event.product_id}', '${event.category}', '${event.product_name}', ${event.product_price},
          '${event.currency}', ${event.quantity}, ${event.cart_value}, '${event.order_id}', ${event.revenue},
          '${event.custom_properties}', '${timestamp}'
        )`;
        })
        .join(",");

      await clickhouse.exec({
        query: `
          INSERT INTO pixel_events (
            id, store_id, subscriber_id, session_id, event_type, event_name, page_url, referrer_url,
            user_agent, ip_address, device_type, browser, operating_system, screen_resolution, viewport_size,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            product_id, category, product_name, product_price, currency, quantity, cart_value, order_id, revenue,
            custom_properties, timestamp
          ) VALUES ${values}
        `,
      });

      totalEvents += batch.length;

      if (totalEvents % 50000 === 0) {
        console.log(`  📊 Inserted ${totalEvents} pixel events...`);
      }
    }

    console.log(`✅ Created ${totalEvents} pixel events in ClickHouse`);
  }

  generateSessions(totalEvents) {
    const sessionsCount = Math.ceil(
      totalEvents / faker.number.int({ min: 5, max: 20 })
    );
    const sessions = [];

    for (let i = 0; i < sessionsCount; i++) {
      const sessionStart = faker.date.recent({ days: 90 });
      const sessionDuration = faker.number.int({ min: 30, max: 3600 }); // 30 seconds to 1 hour
      const eventsInSession = Math.min(
        faker.number.int({ min: 3, max: 25 }),
        Math.ceil(totalEvents / sessionsCount)
      );

      const events = [];

      // Always start with session_start
      events.push({
        type: "session_start",
        timestamp: sessionStart,
      });

      // Add page views and other events
      for (let j = 1; j < eventsInSession - 1; j++) {
        const eventTime = new Date(
          sessionStart.getTime() + (j * sessionDuration) / eventsInSession
        );
        const eventType = this.getWeightedEventType();

        events.push({
          type: eventType,
          timestamp: eventTime,
        });
      }

      // End with session_end or purchase
      const endEventType =
        faker.helpers.maybe(() => "purchase", { probability: 0.1 }) ||
        "session_end";
      events.push({
        type: endEventType,
        timestamp: new Date(sessionStart.getTime() + sessionDuration),
      });

      sessions.push({ events });
      totalEvents -= eventsInSession;
      if (totalEvents <= 0) break;
    }

    return sessions;
  }

  getWeightedEventType() {
    const weights = {
      page_view: 40,
      product_view: 20,
      category_view: 10,
      search: 8,
      add_to_cart: 7,
      wishlist_add: 5,
      checkout_start: 4,
      remove_from_cart: 3,
      checkout_complete: 2,
      purchase: 1,
    };

    const totalWeight = Object.values(weights).reduce(
      (sum, weight) => sum + weight,
      0
    );
    const random = faker.number.int({ min: 1, max: totalWeight });

    let currentWeight = 0;
    for (const [eventType, weight] of Object.entries(weights)) {
      currentWeight += weight;
      if (random <= currentWeight) {
        return eventType;
      }
    }

    return "page_view";
  }

  generatePixelEvent({
    subscriberId,
    storeId,
    sessionId,
    eventType,
    timestamp,
    deviceType,
    browser,
    os,
    userAgent,
    ipAddress,
    country,
    currencies,
  }) {
    const baseEvent = {
      id: faker.string.uuid(),
      store_id: storeId,
      subscriber_id: subscriberId,
      session_id: sessionId,
      event_type: eventType,
      event_name: this.getEventName(eventType),
      page_url: this.generatePageUrl(eventType),
      referrer_url:
        faker.helpers.maybe(() => faker.internet.url(), { probability: 0.6 }) ||
        "",
      user_agent: userAgent,
      ip_address: ipAddress,
      device_type: deviceType,
      browser: browser,
      operating_system: os,
      screen_resolution: faker.helpers.arrayElement([
        "1920x1080",
        "1366x768",
        "1440x900",
        "1024x768",
        "2560x1440",
      ]),
      viewport_size: faker.helpers.arrayElement([
        "1200x800",
        "1024x768",
        "800x600",
        "1440x900",
      ]),
      utm_source:
        faker.helpers.maybe(
          () =>
            faker.helpers.arrayElement([
              "google",
              "facebook",
              "twitter",
              "instagram",
              "email",
            ]),
          { probability: 0.3 }
        ) || "",
      utm_medium:
        faker.helpers.maybe(
          () =>
            faker.helpers.arrayElement([
              "cpc",
              "organic",
              "social",
              "email",
              "display",
            ]),
          { probability: 0.3 }
        ) || "",
      utm_campaign:
        faker.helpers.maybe(() => faker.lorem.words(2).replace(" ", "_"), {
          probability: 0.3,
        }) || "",
      utm_term:
        faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.2 }) ||
        "",
      utm_content:
        faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.2 }) ||
        "",
      product_id: "",
      category: "",
      product_name: "",
      product_price: 0,
      currency: faker.helpers.arrayElement(currencies),
      quantity: 0,
      cart_value: 0,
      order_id: "",
      revenue: 0,
      custom_properties: "{}",
      timestamp: timestamp,
    };

    // Add event-specific data
    switch (eventType) {
      case "product_view":
      case "add_to_cart":
      case "remove_from_cart":
        baseEvent.product_id = faker.string.uuid();
        baseEvent.product_name = faker.commerce.productName();
        baseEvent.product_price = parseFloat(
          faker.commerce.price({ min: 10, max: 500 })
        );
        baseEvent.category = faker.helpers.arrayElement([
          "electronics",
          "clothing",
          "books",
          "home",
          "sports",
        ]);
        if (eventType === "add_to_cart") {
          baseEvent.quantity = faker.number.int({ min: 1, max: 5 });
          baseEvent.cart_value = baseEvent.product_price * baseEvent.quantity;
        }
        break;

      case "purchase":
      case "checkout_complete":
        baseEvent.order_id = faker.string.uuid();
        baseEvent.revenue = faker.number.float({
          min: 25,
          max: 1000,
          fractionDigits: 2,
        });
        baseEvent.quantity = faker.number.int({ min: 1, max: 10 });
        baseEvent.product_id = faker.string.uuid();
        baseEvent.product_name = faker.commerce.productName();
        baseEvent.category = faker.helpers.arrayElement([
          "electronics",
          "clothing",
          "books",
          "home",
          "sports",
        ]);
        break;

      case "search":
        baseEvent.custom_properties = JSON.stringify({
          search_term: faker.lorem.words(faker.number.int({ min: 1, max: 3 })),
          results_count: faker.number.int({ min: 0, max: 100 }),
        });
        break;

      case "category_view":
        baseEvent.category = faker.helpers.arrayElement([
          "electronics",
          "clothing",
          "books",
          "home",
          "sports",
        ]);
        break;
    }

    return baseEvent;
  }

  getEventName(eventType) {
    const eventNames = {
      page_view: "Page Viewed",
      session_start: "Session Started",
      session_end: "Session Ended",
      product_view: "Product Viewed",
      add_to_cart: "Added to Cart",
      remove_from_cart: "Removed from Cart",
      checkout_start: "Checkout Started",
      checkout_complete: "Checkout Completed",
      purchase: "Purchase Completed",
      search: "Search Performed",
      category_view: "Category Viewed",
      wishlist_add: "Added to Wishlist",
    };

    return eventNames[eventType] || eventType;
  }

  generatePageUrl(eventType) {
    const baseUrl = "https://store.example.com";

    switch (eventType) {
      case "product_view":
        return `${baseUrl}/products/${faker.lorem.slug()}`;
      case "category_view":
        return `${baseUrl}/categories/${faker.lorem.word()}`;
      case "search":
        return `${baseUrl}/search?q=${faker.lorem.word()}`;
      case "checkout_start":
      case "checkout_complete":
        return `${baseUrl}/checkout`;
      case "add_to_cart":
      case "remove_from_cart":
        return `${baseUrl}/cart`;
      default:
        return `${baseUrl}/${faker.lorem.slug()}`;
    }
  }

  async seedAnalyticsEvents(subscribers) {
    console.log("📧 Seeding analytics events in ClickHouse...");

    const channels = ["email", "push", "sms"];
    const eventTypes = {
      email: [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "unsubscribed",
        "spam_reported",
      ],
      push: ["sent", "delivered", "opened", "clicked", "dismissed"],
      sms: ["sent", "delivered", "clicked", "bounced", "unsubscribed"],
    };

    const batchSize = 1000;
    let totalEvents = 0;

    // Sample 40% of subscribers for analytics events
    const subscriberIds = subscribers.map((sub) => sub.id);
    const subscriberSample = faker.helpers.arrayElements(
      subscriberIds,
      Math.floor(subscriberIds.length * 0.1)
    );
    console.log(subscriberSample);
    const allEvents = [];

    for (const subscriberId of subscriberSample) {
      const subscriber = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: {
          id: true,
          store_id: true,
          created_at: true,
          country: true,
          state: true,
          city: true,
          is_email_optin: true,
          is_push_optin: true,
          is_sms_optin: true,
        },
      });

      if (!subscriber) continue;

      // Generate campaigns and messages for this subscriber
      const campaigns = this.generateCampaigns(
        subscriber.store_id,
        this.config.daysOfHistory
      );

      for (const campaign of campaigns) {
        // Check if subscriber is opted in for this channel
        if (!this.isOptedInForChannel(campaign.channel, subscriber)) continue;

        const messageEvents = this.generateMessageEvents({
          subscriber,
          campaign,
          eventTypes: eventTypes[campaign.channel],
        });

        allEvents.push(...messageEvents);
      }
    }

    // Insert events in batches
    for (let i = 0; i < allEvents.length; i += batchSize) {
      const batch = allEvents.slice(i, i + batchSize);

      const values = batch
        .map((event) => {
          const timestamp = event.timestamp
            .toISOString()
            .replace("T", " ")
            .replace("Z", "");
          return `(
          '${event.id}', '${event.store_id}', '${event.subscriber_id}', '${event.campaign_id}', '${event.message_id}',
          '${event.channel}', '${event.event_type}', '${event.subject}', '${event.content_type}', '${event.template_id}',
          '${event.link_url}', '${event.link_text}', ${event.position}, '${event.device_type}', '${event.client}',
          '${event.operating_system}', '${event.ip_address}', '${event.user_agent}', '${event.location_country}',
          '${event.location_region}', '${event.location_city}', ${event.engagement_score}, ${event.time_to_open},
          ${event.time_to_click}, '${event.bounce_category}', '${event.unsubscribe_reason}', '${event.custom_attributes}',
          '${timestamp}'
        )`;
        })
        .join(",");

      await clickhouse.exec({
        query: `
          INSERT INTO analytics (
            id, store_id, subscriber_id, campaign_id, message_id, channel, event_type, subject, content_type, template_id,
            link_url, link_text, position, device_type, client, operating_system, ip_address, user_agent,
            location_country, location_region, location_city, engagement_score, time_to_open, time_to_click,
            bounce_category, unsubscribe_reason, custom_attributes, timestamp
          ) VALUES ${values}
        `,
      });

      totalEvents += batch.length;

      if (totalEvents % 25000 === 0) {
        console.log(`  📊 Inserted ${totalEvents} analytics events...`);
      }
    }

    console.log(`✅ Created ${totalEvents} analytics events in ClickHouse`);
  }

  generateCampaigns(storeId, daysOfHistory) {
    const campaignCount = faker.number.int({ min: 10, max: 30 });
    const campaigns = [];

    for (let i = 0; i < campaignCount; i++) {
      const channel = faker.helpers.arrayElement(["email", "push", "sms"]);
      const sentDate = faker.date.recent({ days: daysOfHistory });

      campaigns.push({
        id: faker.string.uuid(),
        store_id: storeId,
        channel,
        type: faker.helpers.arrayElement([
          "promotional",
          "transactional",
          "newsletter",
          "welcome",
          "abandoned_cart",
        ]),
        subject: this.generateSubject(channel),
        sent_date: sentDate,
      });
    }

    return campaigns;
  }

  generateSubject(channel) {
    const subjects = {
      email: [
        "Limited Time Offer - 50% Off Everything!",
        "Your Cart is Waiting for You",
        "Welcome to Our Store!",
        "New Arrivals Just for You",
        "Flash Sale - 24 Hours Only!",
        "Your Order Confirmation",
        "Dont Miss Out - Sale Ends Tonight",
        "Exclusive Member Benefits Inside",
      ],
      push: [
        "Flash Sale Alert!",
        "Your Order Has Shipped",
        "Special Offer Just for You",
        "Items in Your Cart",
        "New Products Available",
        "Welcome Back!",
        "Price Drop Alert",
        "App Update Available",
      ],
      sms: [
        "FLASH SALE: 50% off everything! Use code SAVE50",
        "Your order #12345 has been shipped!",
        "Hi! Items in your cart are selling fast",
        "Exclusive: 30% off for VIP members only",
        "Your verification code is: 123456",
        "Sale alert: Your wishlist items are on sale!",
        "Welcome! Get 20% off your first order",
        "Reminder: Complete your purchase",
      ],
    };

    return faker.helpers.arrayElement(subjects[channel]);
  }

  generateMessageEvents({ subscriber, campaign, eventTypes }) {
    const events = [];
    const messageId = faker.string.uuid();
    let currentTime = new Date(campaign.sent_date);

    // Always start with 'sent'
    events.push(
      this.createAnalyticsEvent({
        subscriber,
        campaign,
        messageId,
        eventType: "sent",
        timestamp: currentTime,
      })
    );

    // Delivery simulation
    const deliveryRate = this.getDeliveryRate(campaign.channel);
    if (faker.datatype.boolean({ probability: deliveryRate })) {
      currentTime = new Date(
        currentTime.getTime() + faker.number.int({ min: 1000, max: 30000 })
      ); // 1-30 seconds delay
      events.push(
        this.createAnalyticsEvent({
          subscriber,
          campaign,
          messageId,
          eventType: "delivered",
          timestamp: currentTime,
        })
      );

      // Engagement simulation
      this.simulateEngagement({
        events,
        subscriber,
        campaign,
        messageId,
        baseTime: currentTime,
        eventTypes,
      });
    } else {
      // Bounce event
      currentTime = new Date(
        currentTime.getTime() + faker.number.int({ min: 5000, max: 60000 })
      ); // 5-60 seconds delay
      events.push(
        this.createAnalyticsEvent({
          subscriber,
          campaign,
          messageId,
          eventType: "bounced",
          timestamp: currentTime,
          bounceCategory: faker.helpers.arrayElement([
            "hard",
            "soft",
            "technical",
          ]),
        })
      );
    }

    return events;
  }

  simulateEngagement({
    events,
    subscriber,
    campaign,
    messageId,
    baseTime,
    eventTypes,
  }) {
    const openRate = this.getOpenRate(campaign.channel, campaign.type);
    const clickRate = this.getClickRate(campaign.channel, campaign.type);

    let currentTime = new Date(baseTime);

    // Open simulation
    if (faker.datatype.boolean({ probability: openRate })) {
      const timeToOpen = faker.number.int({ min: 60, max: 86400 }); // 1 minute to 24 hours
      currentTime = new Date(baseTime.getTime() + timeToOpen * 1000);

      events.push(
        this.createAnalyticsEvent({
          subscriber,
          campaign,
          messageId,
          eventType: "opened",
          timestamp: currentTime,
          timeToOpen,
        })
      );

      // Click simulation (only if opened)
      if (faker.datatype.boolean({ probability: clickRate / openRate })) {
        const timeToClick = faker.number.int({ min: 1, max: 3600 }); // 1 second to 1 hour after open
        currentTime = new Date(currentTime.getTime() + timeToClick * 1000);

        events.push(
          this.createAnalyticsEvent({
            subscriber,
            campaign,
            messageId,
            eventType: "clicked",
            timestamp: currentTime,
            timeToClick,
            linkUrl: this.generateLinkUrl(campaign.type),
            linkText: this.generateLinkText(campaign.type),
          })
        );
      }
    }

    // Unsubscribe simulation (low probability)
    if (faker.datatype.boolean({ probability: 0.005 })) {
      const timeToUnsubscribe = faker.number.int({ min: 300, max: 7200 }); // 5 minutes to 2 hours
      currentTime = new Date(baseTime.getTime() + timeToUnsubscribe * 1000);

      events.push(
        this.createAnalyticsEvent({
          subscriber,
          campaign,
          messageId,
          eventType: "unsubscribed",
          timestamp: currentTime,
          unsubscribeReason: faker.helpers.arrayElement([
            "too_frequent",
            "not_relevant",
            "spam",
            "other",
            "never_signed_up",
          ]),
        })
      );
    }
  }

  createAnalyticsEvent({
    subscriber,
    campaign,
    messageId,
    eventType,
    timestamp,
    timeToOpen = 0,
    timeToClick = 0,
    bounceCategory = "",
    unsubscribeReason = "",
    linkUrl = "",
    linkText = "",
  }) {
    return {
      id: faker.string.uuid(),
      store_id: subscriber.store_id,
      subscriber_id: subscriber.id,
      campaign_id: campaign.id,
      message_id: messageId,
      channel: campaign.channel,
      event_type: eventType,
      subject: campaign.subject,
      content_type: faker.helpers.arrayElement(["html", "text", "rich"]),
      template_id: faker.string.uuid(),
      link_url: linkUrl,
      link_text: linkText,
      position: linkUrl ? faker.number.int({ min: 1, max: 10 }) : 0,
      device_type: faker.helpers.arrayElement(["mobile", "desktop", "tablet"]),
      client: this.getEmailClient(campaign.channel),
      operating_system: faker.helpers.arrayElement([
        "iOS",
        "Android",
        "Windows",
        "macOS",
        "Linux",
      ]),
      ip_address: faker.internet.ip(),
      user_agent: faker.internet.userAgent(),
      location_country: "",
      location_region: "",
      location_city: "",
      engagement_score: this.calculateEngagementScore(
        eventType,
        timeToOpen,
        timeToClick
      ),
      time_to_open: timeToOpen,
      time_to_click: timeToClick,
      bounce_category: bounceCategory,
      unsubscribe_reason: unsubscribeReason,
      custom_attributes: JSON.stringify({
        campaign_type: campaign.type,
        ab_test_group: faker.helpers.arrayElement(["A", "B", "control"]),
        personalized: faker.datatype.boolean(),
      }),
      timestamp,
    };
  }

  getDeliveryRate(channel) {
    const rates = {
      email: 0.95,
      push: 0.85,
      sms: 0.98,
    };
    return rates[channel] || 0.9;
  }

  getOpenRate(channel, campaignType) {
    const rates = {
      email: {
        promotional: 0.22,
        transactional: 0.45,
        newsletter: 0.28,
        welcome: 0.35,
        abandoned_cart: 0.3,
      },
      push: {
        promotional: 0.12,
        transactional: 0.25,
        newsletter: 0.08,
        welcome: 0.18,
        abandoned_cart: 0.15,
      },
      sms: {
        promotional: 0.45,
        transactional: 0.85,
        newsletter: 0.35,
        welcome: 0.55,
        abandoned_cart: 0.5,
      },
    };
    return rates[channel]?.[campaignType] || 0.2;
  }

  getClickRate(channel, campaignType) {
    const rates = {
      email: {
        promotional: 0.035,
        transactional: 0.08,
        newsletter: 0.025,
        welcome: 0.045,
        abandoned_cart: 0.065,
      },
      push: {
        promotional: 0.02,
        transactional: 0.05,
        newsletter: 0.015,
        welcome: 0.03,
        abandoned_cart: 0.04,
      },
      sms: {
        promotional: 0.15,
        transactional: 0.25,
        newsletter: 0.08,
        welcome: 0.18,
        abandoned_cart: 0.22,
      },
    };
    return rates[channel]?.[campaignType] || 0.03;
  }

  generateLinkUrl(campaignType) {
    const baseUrl = "https://store.example.com";
    const urls = {
      promotional: [`${baseUrl}/sale`, `${baseUrl}/offers`, `${baseUrl}/deals`],
      transactional: [
        `${baseUrl}/account/orders`,
        `${baseUrl}/tracking`,
        `${baseUrl}/receipt`,
      ],
      newsletter: [`${baseUrl}/blog`, `${baseUrl}/news`, `${baseUrl}/featured`],
      welcome: [
        `${baseUrl}/welcome`,
        `${baseUrl}/getting-started`,
        `${baseUrl}/account/setup`,
      ],
      abandoned_cart: [
        `${baseUrl}/cart`,
        `${baseUrl}/checkout`,
        `${baseUrl}/complete-purchase`,
      ],
    };

    return faker.helpers.arrayElement(urls[campaignType] || urls.promotional);
  }

  generateLinkText(campaignType) {
    const texts = {
      promotional: ["Shop Now", "Get Deal", "Save Today", "Shop Sale"],
      transactional: [
        "View Order",
        "Track Package",
        "Download Receipt",
        "Update Account",
      ],
      newsletter: ["Read More", "Learn More", "View Article", "See Details"],
      welcome: ["Get Started", "Complete Setup", "Explore", "Begin Journey"],
      abandoned_cart: [
        "Complete Purchase",
        "Return to Cart",
        "Finish Checkout",
        "Buy Now",
      ],
    };

    return faker.helpers.arrayElement(texts[campaignType] || texts.promotional);
  }

  getEmailClient(channel) {
    if (channel === "push") {
      return faker.helpers.arrayElement([
        "Chrome",
        "Safari",
        "Firefox",
        "Edge",
      ]);
    }

    if (channel === "sms") {
      return faker.helpers.arrayElement([
        "Messages",
        "WhatsApp",
        "Telegram",
        "Signal",
      ]);
    }

    // Email clients
    return faker.helpers.arrayElement([
      "Gmail",
      "Outlook",
      "Apple Mail",
      "Yahoo Mail",
      "Thunderbird",
      "Webmail",
    ]);
  }

  calculateEngagementScore(eventType, timeToOpen, timeToClick) {
    let score = 0;

    switch (eventType) {
      case "sent":
        score = 1;
        break;
      case "delivered":
        score = 2;
        break;
      case "opened":
        score = 5;
        // Bonus for quick opens
        if (timeToOpen < 3600) score += 2; // Within 1 hour
        if (timeToOpen < 300) score += 3; // Within 5 minutes
        break;
      case "clicked":
        score = 10;
        // Bonus for quick clicks
        if (timeToClick < 300) score += 5; // Within 5 minutes
        if (timeToClick < 60) score += 3; // Within 1 minute
        break;
      case "bounced":
        score = -2;
        break;
      case "unsubscribed":
        score = -5;
        break;
      case "spam_reported":
        score = -10;
        break;
    }

    return Math.max(0, score);
  }

  isOptedInForChannel(channel, subscriber) {
    switch (channel) {
      case "email":
        return subscriber.is_email_optin;
      case "push":
        return subscriber.is_push_optin;
      case "sms":
        return subscriber.is_sms_optin;
      default:
        return false;
    }
  }

  async printSeedingSummary() {
    console.log("\n📊 Seeding Summary:");
    console.log("==================");

    // PostgreSQL counts
    const pgCounts = await Promise.all([
      prisma.subscriber.count(),
      prisma.segment.count(),
      prisma.segmentSubscriber.count(),
    ]);

    // ClickHouse counts
    const pixelEventsResult = await clickhouse.query({
      query: "SELECT count() as count FROM pixel_events",
      format: "JSONEachRow",
    });
    const pixelEventsCount = parseInt(
      (await pixelEventsResult.json())[0].count
    );

    const analyticsResult = await clickhouse.query({
      query: "SELECT count() as count FROM analytics",
      format: "JSONEachRow",
    });
    const analyticsCount = parseInt((await analyticsResult.json())[0].count);

    console.log(`👥 Subscribers (PostgreSQL): ${pgCounts[0].toLocaleString()}`);
    console.log(`📊 Segments (PostgreSQL): ${pgCounts[1].toLocaleString()}`);
    console.log(
      `🔗 Segment Relationships (PostgreSQL): ${pgCounts[2].toLocaleString()}`
    );
    console.log(
      `🎯 Pixel Events (ClickHouse): ${pixelEventsCount.toLocaleString()}`
    );
    console.log(
      `📧 Analytics Events (ClickHouse): ${analyticsCount.toLocaleString()}`
    );

    // ClickHouse performance insights
    const performanceStats = await this.getClickHouseStats();
    console.log("\n📈 ClickHouse Insights:");
    console.log("=======================");
    console.log(`Most active event type: ${performanceStats.topEventType}`);
    console.log(
      `Average events per subscriber: ${performanceStats.avgEventsPerSubscriber}`
    );
    console.log(`Peak activity hour: ${performanceStats.peakHour}:00`);
    console.log(`Total revenue tracked: ${performanceStats.totalRevenue}`);
    console.log(`Email open rate: ${performanceStats.emailOpenRate}%`);
    console.log(`Email click rate: ${performanceStats.emailClickRate}%`);
  }

  async getClickHouseStats() {
    // Get top event type
    const topEventResult = await clickhouse.query({
      query: `
        SELECT event_type, count() as count 
        FROM pixel_events 
        GROUP BY event_type 
        ORDER BY count DESC 
        LIMIT 1
      `,
      format: "JSONEachRow",
    });
    const topEvent = (await topEventResult.json())[0];

    // Get average events per subscriber
    const avgEventsResult = await clickhouse.query({
      query: `
        SELECT round(count() / uniq(subscriber_id), 2) as avg_events
        FROM pixel_events
      `,
      format: "JSONEachRow",
    });
    const avgEvents = (await avgEventsResult.json())[0];

    // Get peak activity hour
    const peakHourResult = await clickhouse.query({
      query: `
        SELECT hour, count() as count
        FROM pixel_events
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 1
      `,
      format: "JSONEachRow",
    });
    const peakHour = (await peakHourResult.json())[0];

    // Get total revenue
    const revenueResult = await clickhouse.query({
      query: `SELECT round(sum(revenue), 2) as total_revenue FROM pixel_events WHERE revenue > 0`,
      format: "JSONEachRow",
    });
    const revenue = (await revenueResult.json())[0];

    // Get email engagement rates
    const emailStatsResult = await clickhouse.query({
      query: `
        SELECT 
          round(countIf(event_type = 'opened') * 100.0 / countIf(event_type = 'delivered'), 2) as open_rate,
          round(countIf(event_type = 'clicked') * 100.0 / countIf(event_type = 'delivered'), 2) as click_rate
        FROM analytics 
        WHERE channel = 'email'
      `,
      format: "JSONEachRow",
    });
    const emailStats = (await emailStatsResult.json())[0];

    return {
      topEventType: topEvent?.event_type || "N/A",
      avgEventsPerSubscriber: avgEvents?.avg_events || 0,
      peakHour: peakHour?.hour || 0,
      totalRevenue: revenue?.total_revenue || 0,
      emailOpenRate: emailStats?.open_rate || 0,
      emailClickRate: emailStats?.click_rate || 0,
    };
  }
}

// CLI interface for easy usage
async function main() {
  const config = { ...defaultConfig };

  const seeder = new ClickHouseSeeder();
  await seeder.seed(config);
}

// Export for use in other files
export { ClickHouseSeeder };

// Run if called directly
// if (require.main === module) {
// main().catch(console.error);
// }
main().catch(console.error);
