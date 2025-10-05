import { IntegrationProvider, IEmailCapture } from "../types";
import { Integration } from "../models/Integration";

export interface EmailMarketingContact {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface EmailMarketingList {
  id: string;
  name: string;
  subscriberCount: number;
}

export interface EmailMarketingCampaign {
  id: string;
  name: string;
  status: string;
  subject: string;
  sendTime?: Date;
  recipientCount: number;
}

export class EmailMarketingService {
  /**
   * Get user's email marketing integrations
   */
  static async getUserIntegrations(userId: string) {
    return await Integration.find({
      userId,
      provider: {
        $in: [
          IntegrationProvider.MAILCHIMP,
          IntegrationProvider.CONVERTKIT,
          IntegrationProvider.ACTIVE_CAMPAIGN,
          IntegrationProvider.DRIP,
          IntegrationProvider.SENDINBLUE,
        ],
      },
    });
  }

  /**
   * Add contact to email marketing provider
   */
  static async addContact(
    userId: string,
    provider: IntegrationProvider,
    contact: EmailMarketingContact,
    listId?: string
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
      case IntegrationProvider.MAILCHIMP:
        return await this.addToMailchimp(integration, contact, listId);
      case IntegrationProvider.CONVERTKIT:
        return await this.addToConvertKit(integration, contact);
      case IntegrationProvider.ACTIVE_CAMPAIGN:
        return await this.addToActiveCampaign(integration, contact, listId);
      case IntegrationProvider.DRIP:
        return await this.addToDrip(integration, contact);
      case IntegrationProvider.SENDINBLUE:
        return await this.addToSendinblue(integration, contact, listId);
      default:
        throw new Error(`Unsupported email marketing provider: ${provider}`);
    }
  }

  /**
   * Get lists from email marketing provider
   */
  static async getLists(
    userId: string,
    provider: IntegrationProvider
  ): Promise<EmailMarketingList[]> {
    const integration = await Integration.findOne({
      userId,
      provider,
      status: "active",
    });

    if (!integration) {
      throw new Error(`No active ${provider} integration found`);
    }

    switch (provider) {
      case IntegrationProvider.MAILCHIMP:
        return await this.getMailchimpLists(integration);
      case IntegrationProvider.CONVERTKIT:
        return await this.getConvertKitForms(integration);
      case IntegrationProvider.ACTIVE_CAMPAIGN:
        return await this.getActiveCampaignLists(integration);
      case IntegrationProvider.DRIP:
        return await this.getDripCampaigns(integration);
      case IntegrationProvider.SENDINBLUE:
        return await this.getSendinblueLists(integration);
      default:
        throw new Error(`Unsupported email marketing provider: ${provider}`);
    }
  }

  /**
   * Sync email captures to email marketing provider
   */
  static async syncEmailCaptures(
    userId: string,
    provider: IntegrationProvider,
    emailCaptures: IEmailCapture[],
    listId?: string
  ) {
    const results = [];

    for (const capture of emailCaptures) {
      try {
        const contact: EmailMarketingContact = {
          email: capture.email,
          firstName: capture.firstName,
          lastName: capture.lastName,
          tags: capture.tags,
          customFields: {
            source: capture.source,
            bookTitle: capture.bookTitle,
            capturedAt: capture.createdAt,
          },
        };

        const result = await this.addContact(userId, provider, contact, listId);
        results.push({ success: true, email: capture.email, result });
      } catch (error) {
        results.push({
          success: false,
          email: capture.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  // Mailchimp Integration
  private static async addToMailchimp(
    integration: any,
    contact: EmailMarketingContact,
    listId?: string
  ) {
    const apiKey = integration.decryptedApiKey;
    const serverPrefix = apiKey.split("-")[1];
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`;

    const memberData = {
      email_address: contact.email,
      status: "subscribed",
      merge_fields: {
        FNAME: contact.firstName || "",
        LNAME: contact.lastName || "",
      },
      tags: contact.tags || [],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(memberData),
    });

    if (!response.ok) {
      const error = (await response.json()) as any;
      throw new Error(`Mailchimp error: ${error.detail || error.title}`);
    }

    return await response.json();
  }

  private static async getMailchimpLists(
    integration: any
  ): Promise<EmailMarketingList[]> {
    const apiKey = integration.decryptedApiKey;
    const serverPrefix = apiKey.split("-")[1];
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString(
          "base64"
        )}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Mailchimp lists");
    }

    const data = (await response.json()) as any;
    return data.lists.map((list: any) => ({
      id: list.id,
      name: list.name,
      subscriberCount: list.stats.member_count,
    }));
  }

  // ConvertKit Integration
  private static async addToConvertKit(
    integration: any,
    contact: EmailMarketingContact
  ) {
    const apiKey = integration.decryptedApiKey;
    const url = "https://api.convertkit.com/v3/forms/subscribe";

    const formData = {
      api_key: apiKey,
      email: contact.email,
      first_name: contact.firstName,
      fields: contact.customFields || {},
      tags: contact.tags || [],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ConvertKit error: ${(error as any).message}`);
    }

    return await response.json();
  }

  private static async getConvertKitForms(
    integration: any
  ): Promise<EmailMarketingList[]> {
    const apiKey = integration.decryptedApiKey;
    const url = `https://api.convertkit.com/v3/forms?api_key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Failed to fetch ConvertKit forms");
    }

    const data = (await response.json()) as any;
    return data.forms.map((form: any) => ({
      id: form.id.toString(),
      name: form.name,
      subscriberCount: form.subscriber_count,
    }));
  }

  // ActiveCampaign Integration
  private static async addToActiveCampaign(
    integration: any,
    contact: EmailMarketingContact,
    listId?: string
  ) {
    const apiKey = integration.decryptedApiKey;
    const account = integration.settings?.account;
    const url = `https://${account}.api-us1.com/api/3/contacts`;

    const contactData = {
      contact: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        tags: (contact.tags || []).join(","),
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contactData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ActiveCampaign error: ${(error as any).message}`);
    }

    const result = (await response.json()) as any;

    // Add to list if specified
    if (listId && result.contact) {
      await this.addToActiveCampaignList(
        integration,
        result.contact.id,
        listId
      );
    }

    return result;
  }

  private static async addToActiveCampaignList(
    integration: any,
    contactId: string,
    listId: string
  ) {
    const apiKey = integration.decryptedApiKey;
    const account = integration.settings?.account;
    const url = `https://${account}.api-us1.com/api/3/contactLists`;

    const listData = {
      contactList: {
        list: listId,
        contact: contactId,
        status: 1, // Active
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(listData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ActiveCampaign list error: ${(error as any).message}`);
    }

    return await response.json();
  }

  private static async getActiveCampaignLists(
    integration: any
  ): Promise<EmailMarketingList[]> {
    const apiKey = integration.decryptedApiKey;
    const account = integration.settings?.account;
    const url = `https://${account}.api-us1.com/api/3/lists`;

    const response = await fetch(url, {
      headers: {
        "Api-Token": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch ActiveCampaign lists");
    }

    const data = (await response.json()) as any;
    return data.lists.map((list: any) => ({
      id: list.id,
      name: list.name,
      subscriberCount: list.subscriber_count,
    }));
  }

  // Drip Integration
  private static async addToDrip(
    integration: any,
    contact: EmailMarketingContact
  ) {
    const apiKey = integration.decryptedApiKey;
    const account = integration.settings?.account;
    const url = `https://api.getdrip.com/v2/${account}/subscribers`;

    const subscriberData = {
      subscribers: [
        {
          email: contact.email,
          first_name: contact.firstName,
          last_name: contact.lastName,
          tags: contact.tags || [],
          custom_fields: contact.customFields || {},
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriberData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Drip error: ${(error as any).errors?.[0]?.message || "Unknown error"}`
      );
    }

    return await response.json();
  }

  private static async getDripCampaigns(
    integration: any
  ): Promise<EmailMarketingList[]> {
    const apiKey = integration.decryptedApiKey;
    const account = integration.settings?.account;
    const url = `https://api.getdrip.com/v2/${account}/campaigns`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Drip campaigns");
    }

    const data = (await response.json()) as any;
    return data.campaigns.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      subscriberCount: campaign.subscriber_count,
    }));
  }

  // Sendinblue Integration
  private static async addToSendinblue(
    integration: any,
    contact: EmailMarketingContact,
    listId?: string
  ) {
    const apiKey = integration.decryptedApiKey;
    const url = "https://api.sendinblue.com/v3/contacts";

    const contactData = {
      email: contact.email,
      attributes: {
        FIRSTNAME: contact.firstName,
        LASTNAME: contact.lastName,
        ...contact.customFields,
      },
      listIds: listId ? [parseInt(listId)] : [],
      updateEnabled: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contactData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sendinblue error: ${(error as any).message}`);
    }

    return await response.json();
  }

  private static async getSendinblueLists(
    integration: any
  ): Promise<EmailMarketingList[]> {
    const apiKey = integration.decryptedApiKey;
    const url = "https://api.sendinblue.com/v3/contacts/lists";

    const response = await fetch(url, {
      headers: {
        "api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Sendinblue lists");
    }

    const data = (await response.json()) as any;
    return data.lists.map((list: any) => ({
      id: list.id.toString(),
      name: list.name,
      subscriberCount: list.uniqueSubscribers,
    }));
  }
}
