import axios, { AxiosInstance, AxiosResponse } from "axios";
import crypto from "crypto";
import { IIntegration, IntegrationProvider } from "../types";

export interface BookFunnelConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface BookFunnelCampaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  download_count: number;
  max_downloads?: number;
  expires_at?: string;
}

export interface BookFunnelUpload {
  id: string;
  filename: string;
  size: number;
  status: string;
  created_at: string;
  download_url?: string;
}

export interface BookFunnelArcCode {
  code: string;
  url: string;
  expires_at?: string;
  max_downloads?: number;
  downloads_count: number;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  max_downloads?: number;
  expires_at?: string;
  upload_id: string;
}

export interface CreateArcCodeRequest {
  campaign_id: string;
  quantity: number;
  expires_at?: string;
  max_downloads_per_code?: number;
}

export class BookFunnelService {
  private api: AxiosInstance;
  private apiKey: string;

  constructor(config: BookFunnelConfig) {
    this.apiKey = config.apiKey;

    this.api = axios.create({
      baseURL: config.baseUrl || "https://api.bookfunnel.com/v1",
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Word2Wallet/1.0",
      },
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        console.log(
          `BookFunnel API Request: ${config.method?.toUpperCase()} ${
            config.url
          }`
        );
        return config;
      },
      (error) => {
        console.error("BookFunnel API Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => {
        console.log(
          `BookFunnel API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      (error) => {
        console.error(
          "BookFunnel API Response Error:",
          error.response?.data || error.message
        );
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to get campaigns list as a connection test
      // This is more reliable than /account which might not exist
      const response = await this.api.get("/campaigns", {
        params: { limit: 1 },
      });
      return response.status === 200;
    } catch (error) {
      console.error("BookFunnel connection test failed:", error);
      return false;
    }
  }

  /**
   * Get account information
   * Note: BookFunnel API doesn't have a dedicated /account endpoint
   * This method returns basic info derived from campaigns
   */
  async getAccountInfo(): Promise<any> {
    try {
      // Since /account doesn't exist, we'll get campaigns info as a proxy for account info
      const response = await this.api.get("/campaigns", {
        params: { limit: 1 },
      });

      // Return basic account info structure
      return {
        connected: true,
        campaigns_count: response.data?.length || 0,
        status: "active",
      };
    } catch (error) {
      throw new Error(
        `Failed to get account info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Upload file to BookFunnel
   */
  async uploadFile(
    fileBuffer: Buffer,
    filename: string
  ): Promise<BookFunnelUpload> {
    try {
      const formData = new FormData();
      formData.append("file", new Blob([fileBuffer]), filename);

      const response = await this.api.post("/uploads", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to upload file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<BookFunnelUpload> {
    try {
      const response = await this.api.get(`/uploads/${uploadId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get upload status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create ARC campaign
   */
  async createCampaign(
    request: CreateCampaignRequest
  ): Promise<BookFunnelCampaign> {
    try {
      const response = await this.api.post("/campaigns", request);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create campaign: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get campaign details
   */
  async getCampaign(campaignId: string): Promise<BookFunnelCampaign> {
    try {
      const response = await this.api.get(`/campaigns/${campaignId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get campaign: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * List campaigns
   */
  async listCampaigns(
    limit: number = 50,
    offset: number = 0
  ): Promise<BookFunnelCampaign[]> {
    try {
      const response = await this.api.get("/campaigns", {
        params: { limit, offset },
      });
      return response.data.campaigns || [];
    } catch (error) {
      throw new Error(
        `Failed to list campaigns: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create ARC codes
   */
  async createArcCodes(
    request: CreateArcCodeRequest
  ): Promise<BookFunnelArcCode[]> {
    try {
      const response = await this.api.post("/arc-codes", request);
      return response.data.codes || [];
    } catch (error) {
      throw new Error(
        `Failed to create ARC codes: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get ARC code details
   */
  async getArcCode(code: string): Promise<BookFunnelArcCode> {
    try {
      const response = await this.api.get(`/arc-codes/${code}`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get ARC code: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * List ARC codes for campaign
   */
  async listArcCodes(
    campaignId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<BookFunnelArcCode[]> {
    try {
      const response = await this.api.get(
        `/campaigns/${campaignId}/arc-codes`,
        {
          params: { limit, offset },
        }
      );
      return response.data.codes || [];
    } catch (error) {
      throw new Error(
        `Failed to list ARC codes: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update campaign
   */
  async updateCampaign(
    campaignId: string,
    updates: Partial<CreateCampaignRequest>
  ): Promise<BookFunnelCampaign> {
    try {
      const response = await this.api.patch(
        `/campaigns/${campaignId}`,
        updates
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to update campaign: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    try {
      await this.api.delete(`/campaigns/${campaignId}`);
    } catch (error) {
      throw new Error(
        `Failed to delete campaign: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    try {
      const response = await this.api.get(`/campaigns/${campaignId}/analytics`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get campaign analytics: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || data?.error || `HTTP ${status} Error`;
      return new Error(`BookFunnel API Error (${status}): ${message}`);
    } else if (error.request) {
      return new Error("BookFunnel API: No response received");
    } else {
      return new Error(`BookFunnel API: ${error.message}`);
    }
  }
}

/**
 * Create BookFunnel service instance from integration
 */
export const createBookFunnelService = async (
  integration: IIntegration
): Promise<BookFunnelService> => {
  if (integration.provider !== IntegrationProvider.BOOKFUNNEL) {
    throw new Error("Integration is not a BookFunnel integration");
  }

  if (integration.status !== "active") {
    throw new Error("BookFunnel integration is not active");
  }

  // Decrypt API key (implementation depends on your encryption method)
  const decryptedApiKey = await decryptApiKey(integration.apiKey);

  return new BookFunnelService({
    apiKey: decryptedApiKey,
  });
};

/**
 * Encrypt API key for storage
 */
export const encryptApiKey = (apiKey: string): string => {
  const algorithm = "aes-256-cbc";
  const secretKey = process.env.ENCRYPTION_KEY || "default-secret-key";
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
};

/**
 * Decrypt API key for use
 */
export const decryptApiKey = async (
  encryptedApiKey: string
): Promise<string> => {
  const algorithm = "aes-256-cbc";
  const secretKey = process.env.ENCRYPTION_KEY || "default-secret-key";
  const key = crypto.createHash("sha256").update(secretKey).digest();

  const parts = encryptedApiKey.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted API key format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];

  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};
