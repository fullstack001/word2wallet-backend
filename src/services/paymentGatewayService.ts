import { IntegrationProvider } from "../types";
import { Integration } from "../models/Integration";

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  clientSecret?: string;
  paymentMethodId?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    address?: any;
  };
}

export interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  planId: string;
  customerId: string;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  paymentMethods: PaymentMethod[];
  subscriptions: Subscription[];
}

export class PaymentGatewayService {
  /**
   * Get user's payment gateway integrations
   */
  static async getUserIntegrations(userId: string) {
    return await Integration.find({
      userId,
      provider: {
        $in: [
          IntegrationProvider.STRIPE,
          IntegrationProvider.PAYPAL,
          IntegrationProvider.SQUARE,
          IntegrationProvider.RAZORPAY,
        ],
      },
    });
  }

  /**
   * Create payment intent
   */
  static async createPaymentIntent(
    userId: string,
    provider: IntegrationProvider,
    amount: number,
    currency: string = "usd",
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    const integration = await Integration.findOne({
      userId,
      provider,
      status: "active",
    });

    if (!integration) {
      throw new Error(`No active ${provider} integration found`);
    }

    switch (provider) {
      case IntegrationProvider.STRIPE:
        return await this.createStripePaymentIntent(
          integration,
          amount,
          currency,
          metadata
        );
      case IntegrationProvider.PAYPAL:
        return await this.createPayPalOrder(
          integration,
          amount,
          currency,
          metadata
        );
      case IntegrationProvider.SQUARE:
        return await this.createSquarePayment(
          integration,
          amount,
          currency,
          metadata
        );
      case IntegrationProvider.RAZORPAY:
        return await this.createRazorpayOrder(
          integration,
          amount,
          currency,
          metadata
        );
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  /**
   * Confirm payment
   */
  static async confirmPayment(
    userId: string,
    provider: IntegrationProvider,
    paymentIntentId: string,
    paymentMethodId?: string
  ) {
    const integration = await Integration.findOne({
      userId,
      provider,
      status: "active",
    });

    if (!integration) {
      throw new Error(`No active ${provider} integration found`);
    }

    switch (provider) {
      case IntegrationProvider.STRIPE:
        return await this.confirmStripePayment(
          integration,
          paymentIntentId,
          paymentMethodId
        );
      case IntegrationProvider.PAYPAL:
        return await this.confirmPayPalPayment(integration, paymentIntentId);
      case IntegrationProvider.SQUARE:
        return await this.confirmSquarePayment(integration, paymentIntentId);
      case IntegrationProvider.RAZORPAY:
        return await this.confirmRazorpayPayment(integration, paymentIntentId);
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  /**
   * Create customer
   */
  static async createCustomer(
    userId: string,
    provider: IntegrationProvider,
    email: string,
    name?: string,
    metadata?: Record<string, any>
  ): Promise<Customer> {
    const integration = await Integration.findOne({
      userId,
      provider,
      status: "active",
    });

    if (!integration) {
      throw new Error(`No active ${provider} integration found`);
    }

    switch (provider) {
      case IntegrationProvider.STRIPE:
        return await this.createStripeCustomer(
          integration,
          email,
          name,
          metadata
        );
      case IntegrationProvider.PAYPAL:
        return await this.createPayPalCustomer(
          integration,
          email,
          name,
          metadata
        );
      case IntegrationProvider.SQUARE:
        return await this.createSquareCustomer(
          integration,
          email,
          name,
          metadata
        );
      case IntegrationProvider.RAZORPAY:
        return await this.createRazorpayCustomer(
          integration,
          email,
          name,
          metadata
        );
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  /**
   * Create subscription
   */
  static async createSubscription(
    userId: string,
    provider: IntegrationProvider,
    customerId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<Subscription> {
    const integration = await Integration.findOne({
      userId,
      provider,
      status: "active",
    });

    if (!integration) {
      throw new Error(`No active ${provider} integration found`);
    }

    switch (provider) {
      case IntegrationProvider.STRIPE:
        return await this.createStripeSubscription(
          integration,
          customerId,
          planId,
          paymentMethodId
        );
      case IntegrationProvider.PAYPAL:
        return await this.createPayPalSubscription(
          integration,
          customerId,
          planId
        );
      case IntegrationProvider.SQUARE:
        return await this.createSquareSubscription(
          integration,
          customerId,
          planId
        );
      case IntegrationProvider.RAZORPAY:
        return await this.createRazorpaySubscription(
          integration,
          customerId,
          planId
        );
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  // Stripe Integration
  private static async createStripePaymentIntent(
    integration: any,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    const apiKey = integration.decryptedApiKey;
    const url = "https://api.stripe.com/v1/payment_intents";

    const formData = new URLSearchParams({
      amount: (amount * 100).toString(), // Convert to cents
      currency: currency.toLowerCase(),
      ...(metadata && { metadata: JSON.stringify(metadata) }),
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json()) as any;
      throw new Error(
        `Stripe error: ${error.error?.message || "Unknown error"}`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      amount: data.amount / 100,
      currency: data.currency,
      status: data.status,
      clientSecret: data.client_secret,
    };
  }

  private static async confirmStripePayment(
    integration: any,
    paymentIntentId: string,
    paymentMethodId?: string
  ) {
    const apiKey = integration.decryptedApiKey;
    const url = `https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`;

    const formData = new URLSearchParams();
    if (paymentMethodId) {
      formData.append("payment_method", paymentMethodId);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json()) as any;
      throw new Error(
        `Stripe error: ${error.error?.message || "Unknown error"}`
      );
    }

    return await response.json();
  }

  private static async createStripeCustomer(
    integration: any,
    email: string,
    name?: string,
    metadata?: Record<string, any>
  ): Promise<Customer> {
    const apiKey = integration.decryptedApiKey;
    const url = "https://api.stripe.com/v1/customers";

    const formData = new URLSearchParams({
      email,
      ...(name && { name }),
      ...(metadata && { metadata: JSON.stringify(metadata) }),
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json()) as any;
      throw new Error(
        `Stripe error: ${error.error?.message || "Unknown error"}`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      paymentMethods: [],
      subscriptions: [],
    };
  }

  private static async createStripeSubscription(
    integration: any,
    customerId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<Subscription> {
    const apiKey = integration.decryptedApiKey;
    const url = "https://api.stripe.com/v1/subscriptions";

    const formData = new URLSearchParams({
      customer: customerId,
      items: JSON.stringify([{ price: planId }]),
      ...(paymentMethodId && { default_payment_method: paymentMethodId }),
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json()) as any;
      throw new Error(
        `Stripe error: ${error.error?.message || "Unknown error"}`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      status: data.status,
      currentPeriodStart: new Date(data.current_period_start * 1000),
      currentPeriodEnd: new Date(data.current_period_end * 1000),
      planId: data.items.data[0].price.id,
      customerId: data.customer,
    };
  }

  // PayPal Integration
  private static async createPayPalOrder(
    integration: any,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    const clientId = integration.settings?.clientId;
    const clientSecret = integration.decryptedApiKey;
    const isSandbox = integration.settings?.sandbox || false;
    const baseUrl = isSandbox
      ? "https://api.sandbox.paypal.com"
      : "https://api.paypal.com";

    // Get access token
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get PayPal access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = (tokenData as any).access_token;

    // Create order
    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency.toUpperCase(),
            value: amount.toFixed(2),
          },
          ...(metadata && { custom_id: JSON.stringify(metadata) }),
        },
      ],
    };

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.json();
      throw new Error(
        `PayPal error: ${(error as any).message || "Unknown error"}`
      );
    }

    const order = await orderResponse.json();
    return {
      id: (order as any).id,
      amount,
      currency,
      status: (order as any).status,
    };
  }

  private static async confirmPayPalPayment(integration: any, orderId: string) {
    const clientId = integration.settings?.clientId;
    const clientSecret = integration.decryptedApiKey;
    const isSandbox = integration.settings?.sandbox || false;
    const baseUrl = isSandbox
      ? "https://api.sandbox.paypal.com"
      : "https://api.paypal.com";

    // Get access token
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get PayPal access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = (tokenData as any).access_token;

    // Capture order
    const captureResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!captureResponse.ok) {
      const error = await captureResponse.json();
      throw new Error(
        `PayPal error: ${(error as any).message || "Unknown error"}`
      );
    }

    return await captureResponse.json();
  }

  private static async createPayPalCustomer(
    integration: any,
    email: string,
    name?: string,
    metadata?: Record<string, any>
  ): Promise<Customer> {
    // PayPal doesn't have a separate customer creation endpoint
    // We'll return a mock customer object
    return {
      id: `paypal_${Date.now()}`,
      email,
      name,
      paymentMethods: [],
      subscriptions: [],
    };
  }

  private static async createPayPalSubscription(
    integration: any,
    customerId: string,
    planId: string
  ): Promise<Subscription> {
    // PayPal subscription creation would require additional setup
    // This is a simplified implementation
    throw new Error("PayPal subscriptions require additional setup");
  }

  // Square Integration
  private static async createSquarePayment(
    integration: any,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    const accessToken = integration.decryptedApiKey;
    const locationId = integration.settings?.locationId;
    const isSandbox = integration.settings?.sandbox || false;
    const baseUrl = isSandbox
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";

    const paymentData = {
      source_id: "cnon:card-nonce-ok", // This would come from Square's frontend SDK
      amount_money: {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toUpperCase(),
      },
      idempotency_key: `payment_${Date.now()}`,
      ...(metadata && { note: JSON.stringify(metadata) }),
    };

    const response = await fetch(`${baseUrl}/v2/payments`, {
      method: "POST",
      headers: {
        "Square-Version": "2023-10-18",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Square error: ${(error as any).errors?.[0]?.detail || "Unknown error"}`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.payment.id,
      amount: data.payment.amount_money.amount / 100,
      currency: data.payment.amount_money.currency,
      status: data.payment.status,
    };
  }

  private static async confirmSquarePayment(
    integration: any,
    paymentId: string
  ) {
    // Square payments are typically confirmed immediately
    // This would be used for additional verification if needed
    return { id: paymentId, status: "COMPLETED" };
  }

  private static async createSquareCustomer(
    integration: any,
    email: string,
    name?: string,
    metadata?: Record<string, any>
  ): Promise<Customer> {
    const accessToken = integration.decryptedApiKey;
    const isSandbox = integration.settings?.sandbox || false;
    const baseUrl = isSandbox
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";

    const customerData = {
      given_name: name?.split(" ")[0] || "",
      family_name: name?.split(" ").slice(1).join(" ") || "",
      email_address: email,
      ...(metadata && { note: JSON.stringify(metadata) }),
    };

    const response = await fetch(`${baseUrl}/v2/customers`, {
      method: "POST",
      headers: {
        "Square-Version": "2023-10-18",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Square error: ${(error as any).errors?.[0]?.detail || "Unknown error"}`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.customer.id,
      email: data.customer.email_address,
      name: `${data.customer.given_name} ${data.customer.family_name}`.trim(),
      paymentMethods: [],
      subscriptions: [],
    };
  }

  private static async createSquareSubscription(
    integration: any,
    customerId: string,
    planId: string
  ): Promise<Subscription> {
    // Square subscription creation would require additional setup
    throw new Error("Square subscriptions require additional setup");
  }

  // Razorpay Integration
  private static async createRazorpayOrder(
    integration: any,
    amount: number,
    currency: string,
    metadata?: Record<string, any>
  ): Promise<PaymentIntent> {
    const keyId = integration.settings?.keyId;
    const keySecret = integration.decryptedApiKey;
    const isTestMode = integration.settings?.testMode || false;

    const orderData = {
      amount: Math.round(amount * 100), // Convert to paise/cents
      currency: currency.toUpperCase(),
      receipt: `receipt_${Date.now()}`,
      ...(metadata && { notes: metadata }),
    };

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Razorpay error: ${
          (error as any).error?.description || "Unknown error"
        }`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      amount: data.amount / 100,
      currency: data.currency,
      status: data.status,
    };
  }

  private static async confirmRazorpayPayment(
    integration: any,
    paymentId: string
  ) {
    const keyId = integration.settings?.keyId;
    const keySecret = integration.decryptedApiKey;

    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString(
            "base64"
          )}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: "all" }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Razorpay error: ${
          (error as any).error?.description || "Unknown error"
        }`
      );
    }

    return await response.json();
  }

  private static async createRazorpayCustomer(
    integration: any,
    email: string,
    name?: string,
    metadata?: Record<string, any>
  ): Promise<Customer> {
    const keyId = integration.settings?.keyId;
    const keySecret = integration.decryptedApiKey;

    const customerData = {
      name: name || "",
      email,
      ...(metadata && { notes: metadata }),
    };

    const response = await fetch("https://api.razorpay.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Razorpay error: ${
          (error as any).error?.description || "Unknown error"
        }`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      paymentMethods: [],
      subscriptions: [],
    };
  }

  private static async createRazorpaySubscription(
    integration: any,
    customerId: string,
    planId: string
  ): Promise<Subscription> {
    const keyId = integration.settings?.keyId;
    const keySecret = integration.decryptedApiKey;

    const subscriptionData = {
      plan_id: planId,
      customer_id: customerId,
      total_count: 12, // 12 months
    };

    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Razorpay error: ${
          (error as any).error?.description || "Unknown error"
        }`
      );
    }

    const data = (await response.json()) as any;
    return {
      id: data.id,
      status: data.status,
      currentPeriodStart: new Date(data.current_start * 1000),
      currentPeriodEnd: new Date(data.current_end * 1000),
      planId: data.plan_id,
      customerId: data.customer_id,
    };
  }
}
