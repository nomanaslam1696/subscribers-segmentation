export const testPayload1 = {
  store_id: "store-1", 
  name: "Basic Active Subscribers",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "total_spend", operator: "greater_than", value: 25 },
      { field: "order_count", operator: "greater_equal", value: 1 }
    ]
  },
  return_count_only: true
};



export const testPayload2 = {
  store_id: "store-1",
  name: "High-Value VIP Customers",
  base_conditions: {
    logic: "AND", 
    conditions: [
      { field: "total_spend", operator: "greater_than", value: 1000 },
      { field: "order_count", operator: "greater_equal", value: 5 },
      { field: "tags", operator: "has_any", value: ["vip", "high-value", "loyal"] }
    ]
  },
  limit: 20,
  return_count_only: false
};



export const testPayload3 = {
  store_id: "store-1",
  name: "Recent Purchasers with Email Engagement",
  base_conditions: {
    logic: "AND", 
    conditions: [
      { field: "is_email_optin", operator: "equals", value: 1 },
      { field: "total_spend", operator: "greater_than", value: 100 }
    ]
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "purchase" }
        ]
      }
    },
    {
      table: "analytics",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "channel", operator: "equals", value: "email" },
          { field: "event_type", operator: "equals", value: "opened" }
        ]
      }
    }
  ],
  limit: 15,
  return_count_only: false
};



export const testPayload4 = {
  store_id: "store-1",
  name: "Cart Abandoners (Potential Conversions)",
  base_conditions: {
    logic: "AND", 
    conditions: [
      { field: "is_email_optin", operator: "equals", value: 1 },
      { field: "total_spend", operator: "greater_than", value: 50 }
    ]
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_7_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "add_to_cart" }
        ]
      }
    },
    {
      table: "pixel_events",
      timeframe: { relative: "last_7_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "purchase" }
        ]
      },
      exclude: true
    }
  ],
  limit: 25,
  return_count_only: false
};



export const testPayload5 = {
  store_id: "store-1",
  name: "Email Engagement Segmentation",
  base_conditions: {
    logic: "AND", 
    conditions: [
      { field: "is_email_optin", operator: "equals", value: 1 },
      { field: "order_count", operator: "greater_equal", value: 2 }
    ]
  },
  event_filters: [
    {
      table: "analytics",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "channel", operator: "equals", value: "email" },
          { field: "event_type", operator: "equals", value: "opened" }
        ]
      },
      aggregation: {
        type: "count",
        having: { field: "count", operator: "greater_than", value: 3 }
      }
    }
  ],
  limit: 30,
  return_count_only: false
};



export const klaviyoCondition1 = {
  store_id: "store-1",
  name: "SMS Marketing Opt-in Subscribers",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "is_sms_optin", operator: "equals", value: 1 }
    ]
  },
  limit: 50,
  return_count_only: false
};



export const klaviyoCondition2 = {
  store_id: "store-1",
  name: "Added to Cart 3 Times - Last 30 Days",
  base_conditions: {
    logic: "AND",
    conditions: []
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "add_to_cart" }
        ]
      },
      aggregation: {
        type: "count",
        field: "id",
        having: { field: "count", operator: "equals", value: 3 }
      }
    }
  ],
  limit: 50,
  return_count_only: false
};




export const klaviyoCondition3 = {
  store_id: "store-1",
  name: "Australia-based Subscribers",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "country", operator: "equals", value: "Australia" }
    ]
  },
  limit: 50,
  return_count_only: false
};



export const klaviyoCondition4 = {
  store_id: "store-1",
  name: "SMS List Members (via Tags)",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "tags", operator: "has_any", value: ["sms-list"] }
    ]
  },
  limit: 50,
  return_count_only: false
};



export const klaviyoCondition5 = {
  store_id: "store-1",
  name: "European Union Subscribers",
  base_conditions: {
    logic: "AND",
    conditions: [
      { 
        field: "country", 
        operator: "in", 
        value: [
          "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
          "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", 
          "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg",
          "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia",
          "Slovenia", "Spain", "Sweden"
        ]
      }
    ]
  },
  limit: 50,
  return_count_only: false
};




export const klaviyoCondition6 = {
  store_id: "store-1",
  name: "Viewed Sale Items",
  base_conditions: {
    logic: "AND",
    conditions: []
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_90_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "product_view" },
          { field: "product_name", operator: "contains", value: "Computer" }
        ]
      }
    }
  ],
  limit: 50,
  return_count_only: false
};




export const klaviyoCondition7 = {
  store_id: "store-1",
  name: "First Active After June 18, 2025",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "created_at", operator: "greater_than", value: "2025-06-18" }
    ]
  },
  limit: 50,
  return_count_only: false
};




export const klaviyoCondition8 = {
  store_id: "store-1",
  name: "Checkout Started but No Purchase (Last 30 Days)",
  base_conditions: {
    logic: "AND",
    conditions: []
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "checkout_start" },
          { field: "cart_value", operator: "greater_than", value: 0 }
        ]
      }
    },
  ],
  limit: 50,
  return_count_only: false
};




export const ecommerceSegment1 = {
  store_id: "store-1",
  name: "VIP High Value Customers",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "total_spend", operator: "greater_than", value: 1000 },
      { field: "order_count", operator: "greater_equal", value: 5 },
    ]
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_90_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "purchase" }
        ]
      }
    }
  ],
  limit: 100,
  return_count_only: false
};





export const ecommerceSegment2 = {
  store_id: "store-1",
  name: "Cart Abandoners - Hot Leads",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "is_email_optin", operator: "equals", value: 1 },
      { field: "total_spend", operator: "greater_than", value: 0 }
    ]
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_7_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "add_to_cart" },
          { field: "cart_value", operator: "greater_than", value: 50 }
        ]
      }
    },
    {
      table: "pixel_events",
      timeframe: { relative: "last_7_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "purchase" }
        ]
      },
      exclude: true
    }
  ],
  limit: 75,
  return_count_only: false
};





export const ecommerceSegment4 = {
  store_id: "store-1",
  name: "New Customer Onboarding",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "order_count", operator: "equals", value: 1 },
      { field: "days_since_last_order", operator: "less_equal", value: 30 },
      { field: "is_email_optin", operator: "equals", value: 1 }
    ]
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "purchase" },
          { field: "revenue", operator: "greater_than", value: 25 }
        ]
      }
    }
  ],
  limit: 100,
  return_count_only: false
};




export const ecommerceSegment5 = {
  store_id: "store-1",
  name: "Browse Abandoners - Product Interest",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "is_email_optin", operator: "equals", value: 1 },
      { field: "total_spend", operator: "greater_equal", value: 0 }
    ]
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_3_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "product_view" },
          { field: "product_price", operator: "greater_than", value: 100 }
        ]
      }
    },
    {
      table: "pixel_events",
      timeframe: { relative: "last_3_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "add_to_cart" }
        ]
      },
      exclude: true
    }
  ],
  limit: 60,
  return_count_only: false
};


export const emailReEngagementPayload = {
  store_id: "store-1",
  name: "Email Re-engagement",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "is_email_optin", operator: "equals", value: 1 },
      { field: "is_active", operator: "equals", value: 0 },
      { field: "total_spend", operator: "greater_equal", value: 1000 },
      { field: "order_count", operator: "greater_equal", value: 50 },
      
    ],
  },
  event_filters: [
    {
      table: "analytics",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "channel", operator: "equals", value: "email" },
          { field: "event_type", operator: "equals", value: "open" },
        ],
      },
      exclude: true,
    },
  ],
};



export const complexSegmentPayload = {
  store_id: "store-1",
  name: "Complex Customer Segment",
  base_conditions: {
    logic: "AND",
    conditions: [{ field: "is_active", operator: "equals", value: 0 }],
    groups: [
      {
        logic: "OR",
        conditions: [
          {
            field: "customer_tier",
            operator: "in",
            value: ["gold", "platinum"],
          },
          { field: "total_spend", operator: "greater_than", value: 500 },
        ],
      },
    ],
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { start: "2024-01-01", end: "2024-12-31" },
      conditions: {
        logic: "OR",
        conditions: [
          { field: "event_type", operator: "equals", value: "purchase" },
          { field: "event_type", operator: "equals", value: "add_to_cart" },
        ],
      },
    },
  ],
};

const highValueCustomersPayload = {
  store_id: "store-1",
  name: "High Value Recent Customers",
  description: "Customers with high total spend who made purchases recently",
  base_conditions: {
    logic: "AND",
    conditions: [
      { field: "total_spend", operator: "greater_than", value: 10 },
      // { field: "is_active", operator: "equals", value: 1 },
    ],
  },
  event_filters: [
    {
      table: "pixel_events",
      timeframe: { relative: "last_30_days" },
      conditions: {
        logic: "AND",
        conditions: [
          { field: "event_type", operator: "equals", value: "purchase" },
        ],
      },
      aggregation: {
        type: "count",
        having: { field: "count", operator: "greater_than", value: 0 },
      },
    },
  ],
  limit: 100,
};