import { IUser } from "../types";
import { EmailTemplates } from "./emailTemplates";
import https from "https";

const DOMAIN = process.env.MAILGUN_DOMAIN!;
const API_KEY = process.env.MAILGUN_API_KEY!;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || "noreply@word2wallet.com";
const REGION = (process.env.MAILGUN_REGION || "US").toUpperCase();
const API_BASE = REGION === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net";

export class EmailService {
  /**
   * Generate text version from HTML
   */
  private static generateTextVersion(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Send email via HTTP request (same method as test script)
   */
  private static async sendEmailViaHTTP(emailData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const body = new URLSearchParams(emailData).toString();
      const headers = {
        Authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      };

      const req = https.request(
        {
          hostname: API_BASE,
          port: 443,
          path: `/v3/${DOMAIN}/messages`,
          method: "POST",
          headers,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                resolve(json);
              } else {
                reject(
                  new Error(
                    `HTTP ${res.statusCode || "unknown"}: ${
                      json.message || data
                    }`
                  )
                );
              }
            } catch {
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          });
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Send welcome email when user starts trial
   */
  static async sendTrialStartEmail(user: IUser, trialEndDate: Date) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping trial start email`
        );
        return null;
      }

      const template = EmailTemplates.getTrialStartEmail({
        user,
        trialEndDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@word2wallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Trial start email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send trial start email:", error);
      throw error;
    }
  }

  /**
   * Send email when payment processing starts after trial
   */
  static async sendPaymentProcessingEmail(
    user: IUser,
    subscriptionEndDate: Date
  ) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping payment processing email`
        );
        return null;
      }

      const template = EmailTemplates.getPaymentProcessingEmail({
        user,
        subscriptionEndDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@word2wallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Payment processing email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send payment processing email:", error);
      throw error;
    }
  }

  /**
   * Send email when trial successfully converts to paid subscription
   */
  static async sendTrialSuccessEmail(user: IUser, subscriptionEndDate: Date) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping trial success email`
        );
        return null;
      }

      const template = EmailTemplates.getTrialSuccessEmail({
        user,
        subscriptionEndDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@word2wallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Trial success email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send trial success email:", error);
      throw error;
    }
  }

  /**
   * Send email when payment fails after trial
   */
  static async sendPaymentFailureEmail(user: IUser, retryDate: Date) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping payment failure email`
        );
        return null;
      }

      const template = EmailTemplates.getPaymentFailureEmail({
        user,
        retryDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@word2wallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Payment failure email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send payment failure email:", error);
      throw error;
    }
  }

  /**
   * Send welcome email for new users
   */
  static async sendWelcomeEmail(user: IUser) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping welcome email`
        );
        return null;
      }

      const template = EmailTemplates.getWelcomeEmail({ user });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@word2wallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Welcome email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(user: IUser, resetToken: string) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping password reset email`
        );
        return null;
      }

      const template = EmailTemplates.getPasswordResetEmail({
        user,
        resetToken,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@word2wallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Password reset email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw error;
    }
  }

  /**
   * Send subscription cancelled email
   */
  static async sendSubscriptionCancelledEmail(
    user: IUser,
    cancellationDate: Date
  ) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping subscription cancelled email`
        );
        return null;
      }

      const template = EmailTemplates.getSubscriptionCancelledEmail({
        user,
        cancellationDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@word2wallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Subscription cancelled email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send subscription cancelled email:", error);
      throw error;
    }
  }
}
