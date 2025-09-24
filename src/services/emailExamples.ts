/**
 * Email Examples - Demonstrates how to create new email types
 * This file shows examples of extending the email system
 */

import { EmailTemplates } from "./emailTemplates";
import { EmailService } from "./emailService";
import { IUser } from "../types";
import formData from "form-data";
import Mailgun from "mailgun.js";

// Initialize Mailgun for examples
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY!,
});

const DOMAIN = process.env.MAILGUN_DOMAIN!;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || "noreply@word2wallet.com";

// Example 1: Newsletter Email
export class NewsletterEmailTemplates {
  static getNewsletterEmail(data: {
    user: IUser;
    newsletterContent: string;
  }): any {
    const { user, newsletterContent } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Here's your weekly Word2Wallet newsletter with the latest updates and tips.</p>
      
      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
        <h3 style="color: #1976d2; margin-top: 0;">📰 This Week's Highlights</h3>
        <div style="color: #333;">${newsletterContent}</div>
      </div>
      
       ${EmailTemplates.createButton(
         "Read Full Newsletter",
         `${process.env.FRONTEND_URL}/newsletter`,
         "white",
         "#2196f3"
       )}
     `;

    return {
      subject: "📰 Word2Wallet Weekly Newsletter",
      html: EmailTemplates.getBaseTemplate(
        EmailTemplates.createHeader(
          "📰 Weekly Newsletter",
          "Stay updated with Word2Wallet",
          "linear-gradient(135deg, #2196f3 0%, #1976d2 100%)"
        ) +
          EmailTemplates.createContent(content) +
          EmailTemplates.createFooter(
            "You're receiving this email because you subscribed to our newsletter."
          )
      ),
    };
  }
}

// Example 2: Feature Announcement Email
export class FeatureAnnouncementTemplates {
  static getFeatureAnnouncementEmail(data: {
    user: IUser;
    featureName: string;
    featureDescription: string;
  }): any {
    const { user, featureName, featureDescription } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">We're excited to announce a new feature that will enhance your Word2Wallet experience!</p>
      
      ${EmailTemplates.createInfoBox(
        "🚀 New Feature: " + featureName,
        `
          <p style="margin: 0; color: #333;">${featureDescription}</p>
          <p style="margin: 10px 0 0 0; color: #333;">This feature is now available in your dashboard.</p>
        `,
        "#4caf50",
        "#e8f5e8"
      )}
      
      ${EmailTemplates.createButton(
        "Try New Feature",
        `${process.env.FRONTEND_URL}/dashboard`,
        "white",
        "#4caf50"
      )}
    `;

    return {
      subject: "🚀 New Word2Wallet Feature: " + featureName,
      html: EmailTemplates.getBaseTemplate(
        EmailTemplates.createHeader(
          "🚀 New Feature Available!",
          "Enhance your Word2Wallet experience",
          "linear-gradient(135deg, #4caf50 0%, #388e3c 100%)"
        ) +
          EmailTemplates.createContent(content) +
          EmailTemplates.createFooter(
            "You're receiving this email because you're a Word2Wallet user."
          )
      ),
    };
  }
}

// Example 3: Usage Statistics Email
export class UsageStatisticsTemplates {
  static getUsageStatisticsEmail(data: {
    user: IUser;
    projectsCreated: number;
    totalViews: number;
    month: string;
  }): any {
    const { user, projectsCreated, totalViews, month } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Here's your ${month} usage summary for Word2Wallet.</p>
      
      ${EmailTemplates.createInfoBox(
        "📊 Your ${month} Statistics",
        EmailTemplates.createList([
          `<strong>Projects Created:</strong> ${projectsCreated}`,
          `<strong>Total Views:</strong> ${totalViews.toLocaleString()}`,
          `<strong>Most Active Day:</strong> ${new Date().toLocaleDateString(
            "en-US",
            { weekday: "long" }
          )}`,
        ]),
        "#9c27b0",
        "#f3e5f5"
      )}
      
      ${EmailTemplates.createInfoBox(
        "💡 Tips for Next Month",
        EmailTemplates.createList([
          "Try creating interactive content",
          "Share your projects with the community",
          "Explore advanced features",
          "Join our user group discussions",
        ]),
        "#ff9800",
        "#fff3e0"
      )}
      
      ${EmailTemplates.createButton(
        "View Detailed Analytics",
        `${process.env.FRONTEND_URL}/analytics`,
        "white",
        "#9c27b0"
      )}
    `;

    return {
      subject: `📊 Your ${month} Word2Wallet Usage Summary`,
      html: EmailTemplates.getBaseTemplate(
        EmailTemplates.createHeader(
          "📊 Monthly Summary",
          `Your ${month} Word2Wallet activity`,
          "linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)"
        ) +
          EmailTemplates.createContent(content) +
          EmailTemplates.createFooter(
            "You're receiving this email because you're an active Word2Wallet user."
          )
      ),
    };
  }
}

// Example Service Methods
export class ExtendedEmailService {
  /**
   * Send newsletter email
   */
  static async sendNewsletterEmail(user: IUser, newsletterContent: string) {
    try {
      const template = NewsletterEmailTemplates.getNewsletterEmail({
        user,
        newsletterContent,
      });

      const data = {
        from: `Word2Wallet <${process.env.MAILGUN_FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
      };

      const response = await mg.messages.create(DOMAIN, data);
      console.log("Newsletter email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send newsletter email:", error);
      throw error;
    }
  }

  /**
   * Send feature announcement email
   */
  static async sendFeatureAnnouncementEmail(
    user: IUser,
    featureName: string,
    featureDescription: string
  ) {
    try {
      const template = FeatureAnnouncementTemplates.getFeatureAnnouncementEmail(
        {
          user,
          featureName,
          featureDescription,
        }
      );

      const data = {
        from: `Word2Wallet <${process.env.MAILGUN_FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
      };

      const response = await mg.messages.create(DOMAIN, data);
      console.log("Feature announcement email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send feature announcement email:", error);
      throw error;
    }
  }

  /**
   * Send usage statistics email
   */
  static async sendUsageStatisticsEmail(
    user: IUser,
    projectsCreated: number,
    totalViews: number,
    month: string
  ) {
    try {
      const template = UsageStatisticsTemplates.getUsageStatisticsEmail({
        user,
        projectsCreated,
        totalViews,
        month,
      });

      const data = {
        from: `Word2Wallet <${process.env.MAILGUN_FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html,
      };

      const response = await mg.messages.create(DOMAIN, data);
      console.log("Usage statistics email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send usage statistics email:", error);
      throw error;
    }
  }
}

// Usage Examples in Controllers:

/*
// Example 1: Newsletter Controller
export class NewsletterController {
  static async sendNewsletter(req: Request, res: Response) {
    try {
      const users = await User.find({ newsletterSubscribed: true });
      const newsletterContent = "This week we added new features...";
      
      for (const user of users) {
        await ExtendedEmailService.sendNewsletterEmail(user, newsletterContent);
      }
      
      res.json({ success: true, message: "Newsletter sent to all subscribers" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to send newsletter" });
    }
  }
}

// Example 2: Feature Announcement Controller
export class FeatureController {
  static async announceFeature(req: Request, res: Response) {
    try {
      const { featureName, featureDescription } = req.body;
      const users = await User.find({});
      
      for (const user of users) {
        await ExtendedEmailService.sendFeatureAnnouncementEmail(user, featureName, featureDescription);
      }
      
      res.json({ success: true, message: "Feature announcement sent to all users" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to send feature announcement" });
    }
  }
}

// Example 3: Monthly Statistics Controller
export class StatisticsController {
  static async sendMonthlyStats(req: Request, res: Response) {
    try {
      const users = await User.find({});
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      for (const user of users) {
        const userStats = await getUserStatistics(user._id);
        await ExtendedEmailService.sendUsageStatisticsEmail(
          user, 
          userStats.projectsCreated, 
          userStats.totalViews, 
          currentMonth
        );
      }
      
      res.json({ success: true, message: "Monthly statistics sent to all users" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to send monthly statistics" });
    }
  }
}
*/
