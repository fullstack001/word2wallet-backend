import formData from "form-data";
import Mailgun from "mailgun.js";
import { IUser } from "../types";
import { EmailTemplates } from "./emailTemplates";

// Initialize Mailgun
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY!,
});

const DOMAIN = process.env.MAILGUN_DOMAIN!;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || "noreply@word2wallet.com";

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
   * Send welcome email when user starts trial
   */
  static async sendTrialStartEmail(user: IUser, trialEndDate: Date) {
    try {
      const template = EmailTemplates.getTrialStartEmail({
        user,
        trialEndDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text || this.generateTextVersion(template.html),
        "h:Reply-To": "support@word2wallet.com",
        "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await mg.messages.create(DOMAIN, data);
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
      const template = EmailTemplates.getPaymentProcessingEmail({
        user,
        subscriptionEndDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text || this.generateTextVersion(template.html),
        "h:Reply-To": "support@word2wallet.com",
        "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await mg.messages.create(DOMAIN, data);
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
      const template = EmailTemplates.getTrialSuccessEmail({
        user,
        subscriptionEndDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text || this.generateTextVersion(template.html),
        "h:Reply-To": "support@word2wallet.com",
        "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await mg.messages.create(DOMAIN, data);
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
      const template = EmailTemplates.getPaymentFailureEmail({
        user,
        retryDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text || this.generateTextVersion(template.html),
        "h:Reply-To": "support@word2wallet.com",
        "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await mg.messages.create(DOMAIN, data);
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
      const template = EmailTemplates.getWelcomeEmail({ user });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text || this.generateTextVersion(template.html),
        "h:Reply-To": "support@word2wallet.com",
        "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await mg.messages.create(DOMAIN, data);
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
      const template = EmailTemplates.getPasswordResetEmail({
        user,
        resetToken,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text || this.generateTextVersion(template.html),
        "h:Reply-To": "support@word2wallet.com",
        "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await mg.messages.create(DOMAIN, data);
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
      const template = EmailTemplates.getSubscriptionCancelledEmail({
        user,
        cancellationDate,
      });

      const data = {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text || this.generateTextVersion(template.html),
        "h:Reply-To": "support@word2wallet.com",
        "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await mg.messages.create(DOMAIN, data);
      console.log("Subscription cancelled email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send subscription cancelled email:", error);
      throw error;
    }
  }
}
