import axios from "axios";

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const MAILERLITE_API_URL = "https://connect.mailerlite.com/api";

export interface MailerLiteSubscriber {
  email: string;
  fields?: {
    name?: string;
    last_name?: string;
    [key: string]: any;
  };
  groups?: string[];
  status?: "active" | "unsubscribed" | "unconfirmed" | "bounced" | "junk";
}

export interface SendCampaignOptions {
  subject: string;
  from: string;
  fromName: string;
  content: string;
  emails: string[];
}

export class MailerLiteService {
  private static apiClient = axios.create({
    baseURL: MAILERLITE_API_URL,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${MAILERLITE_API_KEY}`,
    },
  });

  /**
   * Add or update subscriber
   */
  static async addSubscriber(subscriber: MailerLiteSubscriber): Promise<any> {
    try {
      const response = await this.apiClient.post("/subscribers", subscriber);
      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite add subscriber error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Add multiple subscribers in bulk
   */
  static async addSubscribersBulk(
    subscribers: MailerLiteSubscriber[]
  ): Promise<any> {
    try {
      const response = await this.apiClient.post("/subscribers/import", {
        subscribers,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite bulk add error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Create a group (list)
   */
  static async createGroup(name: string): Promise<any> {
    try {
      const response = await this.apiClient.post("/groups", { name });
      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite create group error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Get all groups
   */
  static async getGroups(): Promise<any> {
    try {
      const response = await this.apiClient.get("/groups");
      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite get groups error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Add subscriber to group
   */
  static async addSubscriberToGroup(
    subscriberId: string,
    groupId: string
  ): Promise<any> {
    try {
      const response = await this.apiClient.post(
        `/subscribers/${subscriberId}/groups/${groupId}`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite add to group error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Send campaign to specific emails
   */
  static async sendCampaign(options: SendCampaignOptions): Promise<any> {
    try {
      // First, add all subscribers
      const subscribers = options.emails.map((email) => ({
        email,
        status: "active" as const,
      }));

      // Add subscribers in bulk
      await this.addSubscribersBulk(subscribers);

      // Create campaign
      const campaign = await this.apiClient.post("/campaigns", {
        type: "regular",
        name: `New Book Notification - ${new Date().toISOString()}`,
        subject: options.subject,
        from: options.from,
        from_name: options.fromName,
      });

      const campaignId = campaign.data.data.id;

      // Set campaign content
      await this.apiClient.put(`/campaigns/${campaignId}/content`, {
        html: options.content,
        plain: this.stripHtml(options.content),
      });

      // Send campaign
      const response = await this.apiClient.post(
        `/campaigns/${campaignId}/actions/send`,
        {
          type: "instant",
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite send campaign error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Send transactional email (one-off email)
   */
  static async sendTransactionalEmail(
    to: string,
    subject: string,
    content: string,
    from: string = "noreply@word2wallet.com",
    fromName: string = "Word2Wallet"
  ): Promise<any> {
    try {
      // First ensure subscriber exists
      await this.addSubscriber({
        email: to,
        status: "active",
      });

      // Send email
      const response = await this.apiClient.post("/messages", {
        to: [{ email: to }],
        from: {
          email: from,
          name: fromName,
        },
        subject: subject,
        html: content,
        text: this.stripHtml(content),
      });

      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite send email error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Send bulk emails to multiple recipients
   */
  static async sendBulkEmails(
    emails: string[],
    subject: string,
    content: string,
    from: string = "noreply@word2wallet.com",
    fromName: string = "Word2Wallet"
  ): Promise<{
    success: number;
    failed: number;
    errors: any[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Send emails in batches of 10 to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (email) => {
          try {
            await this.sendTransactionalEmail(
              email,
              subject,
              content,
              from,
              fromName
            );
            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              email,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
      );

      // Add delay between batches
      if (i + batchSize < emails.length) {
        await this.delay(1000); // 1 second delay between batches
      }
    }

    return results;
  }

  /**
   * Get subscriber by email
   */
  static async getSubscriber(email: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/subscribers/${email}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(
        "MailerLite get subscriber error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Unsubscribe a subscriber
   */
  static async unsubscribe(email: string): Promise<any> {
    try {
      const response = await this.apiClient.post(
        `/subscribers/${email}/unsubscribe`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "MailerLite unsubscribe error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Helper: Strip HTML tags
   */
  private static stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Helper: Delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
