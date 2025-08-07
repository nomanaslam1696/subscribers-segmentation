import { PrismaClient } from "./generated";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

const defaultConfig = {
  stores: 5,
  subscribersPerStore: 10000,
  segmentsPerStore: 20,
  engagementRecords: true,
};

class DatabaseSeeder {
  constructor() {
    this.storeIds = ["1", "2", "3", "4", "5", "6"];
    this.subscriberIds = [];
    this.segmentIds = [];
  }

  async seed(config = defaultConfig) {
    console.log("🌱 Starting database seeding...");
    console.log(`Configuration:`, config);

    try {
      // Clean existing data (optional)
      await this.cleanDatabase();

      // Generate store IDs
      this.storeIds = Array.from({ length: config.stores }, () =>
        faker.string.uuid()
      );

      console.log("StoreIds", this.storeIds);

      // Seed subscribers
      await this.seedSubscribers(config);

      // Seed segments
      await this.seedSegments(config);

      // Seed segment relationships
      await this.seedSegmentSubscribers(config);

      // Seed engagement data
      if (config.engagementRecords) {
        await this.seedEngagementData(config);
      }

      console.log("✅ Database seeding completed successfully!");
      await this.printSeedingSummary();
    } catch (error) {
      console.error("❌ Seeding failed:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  async cleanDatabase() {
    console.log("🧹 Cleaning existing data...");

    // Delete in order to respect foreign key constraints
    await prisma.subscriberEngagement.deleteMany();
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

    const firstOrderDate =
      orderCount > 0
        ? faker.date.between({
            from: createdAt,
            to: lastOrderDate || new Date(),
          })
        : null;

    const daysSinceLastOrder = lastOrderDate
      ? Math.floor(
          (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    const averageOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;

    // Generate realistic lifecycle stages and customer tiers
    const lifecycleStage = this.getLifecycleStage(
      orderCount,
      daysSinceLastOrder
    );
    const customerTier = this.getCustomerTier(totalSpend);

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
      first_order_date: firstOrderDate,
      average_order_value: averageOrderValue,
      days_since_last_order: daysSinceLastOrder,
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
          "price-sensitive",
          "premium-buyer",
          "bulk-buyer",
        ],
        { min: 0, max: 4 }
      ),
      is_email_optin: faker.datatype.boolean({ probability: 0.85 }),
      is_push_optin: faker.datatype.boolean({ probability: 0.35 }),
      is_sms_optin: faker.datatype.boolean({ probability: 0.25 }),
      is_active: faker.datatype.boolean({ probability: 0.95 }),
      unsubscribed_at: faker.helpers.maybe(
        () => faker.date.between({ from: createdAt, to: new Date() }),
        { probability: 0.05 }
      ),
      last_seen_at: faker.helpers.maybe(
        () => faker.date.between({ from: createdAt, to: new Date() }),
        { probability: 0.9 }
      ),
      time_zone: faker.helpers.arrayElement([
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Australia/Sydney",
        "America/Chicago",
      ]),
      preferred_language: faker.helpers.arrayElement([
        "en",
        "es",
        "fr",
        "de",
        "it",
        "pt",
      ]),
      lifecycle_stage: lifecycleStage,
      customer_tier: customerTier,
      created_at: createdAt,
      updated_at: faker.date.between({ from: createdAt, to: new Date() }),
    };
  }

  getLifecycleStage(orderCount, daysSinceLastOrder) {
    if (orderCount === 0) return "prospect";
    if (daysSinceLastOrder === null) return "customer";
    if (daysSinceLastOrder > 180) return "churned";
    if (orderCount >= 10 && daysSinceLastOrder <= 30) return "vip";
    return "customer";
  }

  getCustomerTier(totalSpend) {
    if (totalSpend >= 2000) return "platinum";
    if (totalSpend >= 1000) return "gold";
    if (totalSpend >= 500) return "silver";
    if (totalSpend > 0) return "bronze";
    return "none";
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

    // Get created segment IDs
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
        is_dynamic: true,
        segment_type: "demographic",
        conditions: {
          rules: [{ field: "is_active", operator: "equals", value: true }],
        },
        tags: ["default"],
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "VIP Customers",
        description: "High-value customers with multiple orders",
        is_dynamic: true,
        segment_type: "behavioral",
        conditions: {
          rules: [
            {
              field: "customer_tier",
              operator: "in",
              value: ["gold", "platinum"],
            },
            { field: "is_active", operator: "equals", value: true },
          ],
        },
        tags: ["vip", "high-value"],
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "At Risk Customers",
        description: "Customers who haven't ordered recently",
        is_dynamic: true,
        segment_type: "behavioral",
        conditions: {
          rules: [
            {
              field: "days_since_last_order",
              operator: "greater_than",
              value: 90,
            },
            { field: "total_spend", operator: "greater_than", value: 100 },
          ],
        },
        tags: ["at-risk", "win-back"],
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "New Subscribers",
        description: "Recently joined subscribers",
        is_dynamic: true,
        segment_type: "demographic",
        conditions: {
          rules: [
            {
              field: "created_at",
              operator: "greater_than",
              value: "30_days_ago",
            },
            { field: "is_active", operator: "equals", value: true },
          ],
        },
        tags: ["new", "onboarding"],
      },
      {
        id: faker.string.uuid(),
        store_id: storeId,
        name: "Mobile Users",
        description: "Push notification subscribers",
        is_dynamic: true,
        segment_type: "demographic",
        conditions: {
          rules: [
            { field: "is_push_optin", operator: "equals", value: true },
            { field: "is_active", operator: "equals", value: true },
          ],
        },
        tags: ["mobile", "push"],
      },
    ];
  }

  generateCustomSegment(storeId) {
    const segmentTypes = ["demographic", "behavioral", "custom"];
    const segmentType = faker.helpers.arrayElement(segmentTypes);

    return {
      id: faker.string.uuid(),
      store_id: storeId,
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
      is_dynamic: faker.datatype.boolean({ probability: 0.8 }),
      segment_type: segmentType,
      conditions: this.generateSegmentConditions(segmentType),
      tags: faker.helpers.arrayElements(
        ["custom", "targeted", "campaign", "analysis", "test"],
        { min: 1, max: 3 }
      ),
      created_at: faker.date.past({ years: 1 }),
    };
  }

  generateSegmentConditions(segmentType) {
    const demographicFields = [
      "country",
      "state",
      "customer_tier",
      "lifecycle_stage",
    ];
    const behavioralFields = [
      "total_spend",
      "order_count",
      "days_since_last_order",
    ];

    const fields =
      segmentType === "demographic" ? demographicFields : behavioralFields;
    const field = faker.helpers.arrayElement(fields);

    return {
      rules: [
        {
          field,
          operator: faker.helpers.arrayElement([
            "equals",
            "greater_than",
            "less_than",
            "in",
          ]),
          value: this.generateConditionValue(field),
        },
      ],
    };
  }

  generateConditionValue(field) {
    switch (field) {
      case "total_spend":
        return faker.number.int({ min: 100, max: 2000 });
      case "order_count":
        return faker.number.int({ min: 1, max: 20 });
      case "days_since_last_order":
        return faker.number.int({ min: 30, max: 365 });
      case "customer_tier":
        return faker.helpers.arrayElement([
          "bronze",
          "silver",
          "gold",
          "platinum",
        ]);
      case "lifecycle_stage":
        return faker.helpers.arrayElement([
          "prospect",
          "customer",
          "vip",
          "churned",
        ]);
      default:
        return faker.lorem.word();
    }
  }

  async seedSegmentSubscribers(config) {
    console.log("🔗 Seeding segment-subscriber relationships...");

    const batchSize = 1000;
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
          // Add all active subscribers to the default segment
          subscribersToAdd = storeSubscribers;
        } else {
          // Add random subset of subscribers to other segments
          const percentage = faker.number.float({ min: 0.05, max: 0.4 });
          const count = Math.floor(storeSubscribers.length * percentage);
          subscribersToAdd = faker.helpers.arrayElements(
            storeSubscribers,
            count
          );
        }

        // Insert in batches
        for (let i = 0; i < subscribersToAdd.length; i += batchSize) {
          const batch = subscribersToAdd.slice(i, i + batchSize);
          const segmentSubscribers = batch.map((subscriber) => ({
            id: faker.string.uuid(),
            segment_id: segment.id,
            subscriber_id: subscriber.id,
            score: faker.number.float({
              min: 0.1,
              max: 1.0,
              fractionDigits: 2,
            }),
            added_at: faker.date.past({ years: 1 }),
          }));

          await prisma.segmentSubscriber.createMany({
            data: segmentSubscribers,
            skipDuplicates: true,
          });

          totalCreated += batch.length;
        }

        // Update segment subscriber count
        await prisma.segment.update({
          where: { id: segment.id },
          data: { subscriber_count: subscribersToAdd.length },
        });
      }
    }

    console.log(`✅ Created ${totalCreated} segment-subscriber relationships`);
  }

  async seedEngagementData(config) {
    console.log("📈 Seeding engagement data...");

    const channels = ["email", "push", "sms"];
    const engagementData = [];

    // Sample 20% of subscribers for engagement data
    const subscriberSample = faker.helpers.arrayElements(
      this.subscriberIds,
      Math.floor(this.subscriberIds.length * 0.2)
    );

    for (const subscriberId of subscriberSample) {
      const subscriber = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: {
          store_id: true,
          is_email_optin: true,
          is_push_optin: true,
          is_sms_optin: true,
        },
      });

      if (!subscriber) continue;

      for (const channel of channels) {
        // Check if subscriber is opted in for this channel
        const isOptedIn = this.isOptedInForChannel(channel, subscriber);
        if (!isOptedIn) continue;

        const totalSent = faker.number.int({ min: 10, max: 200 });
        const deliveryRate = faker.number.float({ min: 0.85, max: 0.98 });
        const openRate = faker.number.float({ min: 0.1, max: 0.6 });
        const clickRate = faker.number.float({ min: 0.02, max: 0.15 });
        const conversionRate = faker.number.float({ min: 0.005, max: 0.05 });

        const totalDelivered = Math.floor(totalSent * deliveryRate);
        const totalOpened = Math.floor(totalDelivered * openRate);
        const totalClicked = Math.floor(totalOpened * clickRate);
        const totalConverted = Math.floor(totalClicked * conversionRate);

        engagementData.push({
          id: faker.string.uuid(),
          subscriber_id: subscriberId,
          store_id: subscriber.store_id,
          channel,
          total_sent: totalSent,
          total_delivered: totalDelivered,
          total_opened: totalOpened,
          total_clicked: totalClicked,
          total_converted: totalConverted,
          last_engagement_date: faker.helpers.maybe(
            () => faker.date.recent({ days: 30 }),
            { probability: 0.8 }
          ),
          engagement_score: faker.number.float({
            min: 0.1,
            max: 10.0,
            fractionDigits: 2,
          }),
          preferred_send_hour: faker.helpers.maybe(
            () => faker.number.int({ min: 8, max: 20 }),
            { probability: 0.7 }
          ),
          preferred_send_day: faker.helpers.maybe(
            () => faker.number.int({ min: 0, max: 6 }),
            { probability: 0.6 }
          ),
        });
      }
    }

    // Insert engagement data in batches
    const batchSize = 1000;
    for (let i = 0; i < engagementData.length; i += batchSize) {
      const batch = engagementData.slice(i, i + batchSize);
      await prisma.subscriberEngagement.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    console.log(`✅ Created ${engagementData.length} engagement records`);
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

    const counts = await Promise.all([
      prisma.subscriber.count(),
      prisma.segment.count(),
      prisma.segmentSubscriber.count(),
      prisma.subscriberEngagement.count(),
    ]);

    console.log(`👥 Subscribers: ${counts[0].toLocaleString()}`);
    console.log(`📊 Segments: ${counts[1].toLocaleString()}`);
    console.log(`🔗 Segment Relationships: ${counts[2].toLocaleString()}`);
    console.log(`📈 Engagement Records: ${counts[3].toLocaleString()}`);

    // Performance stats
    const performanceStats = await this.getPerformanceStats();
    console.log("\n📈 Performance Insights:");
    console.log("========================");
    console.log(
      `Average subscribers per store: ${performanceStats.avgSubscribersPerStore}`
    );
    console.log(`Email opt-in rate: ${performanceStats.emailOptInRate}%`);
    console.log(`Push opt-in rate: ${performanceStats.pushOptInRate}%`);
    console.log(`SMS opt-in rate: ${performanceStats.smsOptInRate}%`);
    console.log(`Average total spend: $${performanceStats.avgTotalSpend}`);
    console.log(`Customer distribution by tier:`);
    console.log(`  - Bronze: ${performanceStats.tierDistribution.bronze}%`);
    console.log(`  - Silver: ${performanceStats.tierDistribution.silver}%`);
    console.log(`  - Gold: ${performanceStats.tierDistribution.gold}%`);
    console.log(`  - Platinum: ${performanceStats.tierDistribution.platinum}%`);
  }

  async getPerformanceStats() {
    const totalSubscribers = await prisma.subscriber.count();
    const totalStores = this.storeIds.length;

    const optInStats = await prisma.subscriber.aggregate({
      _avg: {
        total_spend: true,
      },
      _count: {
        is_email_optin: true,
        is_push_optin: true,
        is_sms_optin: true,
      },
    });

    const emailOptIns = await prisma.subscriber.count({
      where: { is_email_optin: true },
    });
    const pushOptIns = await prisma.subscriber.count({
      where: { is_push_optin: true },
    });
    const smsOptIns = await prisma.subscriber.count({
      where: { is_sms_optin: true },
    });

    const tierCounts = await prisma.subscriber.groupBy({
      by: ["customer_tier"],
      _count: { id: true },
    });

    const tierDistribution = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    };

    tierCounts.forEach((tier) => {
      if (
        tier.customer_tier &&
        tierDistribution.hasOwnProperty(tier.customer_tier)
      ) {
        tierDistribution[tier.customer_tier] = Math.round(
          (tier._count.id / totalSubscribers) * 100
        );
      }
    });

    return {
      avgSubscribersPerStore: Math.round(totalSubscribers / totalStores),
      emailOptInRate: Math.round((emailOptIns / totalSubscribers) * 100),
      pushOptInRate: Math.round((pushOptIns / totalSubscribers) * 100),
      smsOptInRate: Math.round((smsOptIns / totalSubscribers) * 100),
      avgTotalSpend: optInStats._avg.total_spend?.toFixed(2) || "0.00",
      tierDistribution,
    };
  }
}
