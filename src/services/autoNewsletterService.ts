import { EmailCapture } from "../models/EmailCapture";
import { Book } from "../models/Book";
import { User } from "../models/User";
import { MailerLiteService } from "./mailerLiteService";

export class AutoNewsletterService {
  /**
   * Send "New Book" notification to author's existing readers
   */
  static async sendNewBookNotification(
    authorId: string,
    newBookId: string
  ): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors: any[];
  }> {
    try {
      // Get the new book details
      const newBook = await Book.findById(newBookId);
      if (!newBook) {
        throw new Error("Book not found");
      }

      // Get author details
      const author = await User.findById({ _id: authorId });
      if (!author) {
        throw new Error("Author not found");
      }

      // Get all readers who have subscribed to newsletter from this author
      // This includes readers from ALL previous books by this author
      const readers = await EmailCapture.find({
        userId: authorId,
        subscribedToNewsletter: true,
        isConfirmed: true,
        status: { $ne: "unsubscribed" },
      }).distinct("email");

      if (readers.length === 0) {
        console.log(`No newsletter subscribers found for author ${authorId}`);
        return {
          success: true,
          sentCount: 0,
          failedCount: 0,
          errors: [],
        };
      }

      console.log(`Sending new book notification to ${readers.length} readers`);

      // Build email content
      const subject = `📚 New Book Released: ${newBook.title}`;
      const content = this.buildNewBookEmailTemplate(newBook, author);

      // Send via MailerLite
      const results = await MailerLiteService.sendBulkEmails(
        readers,
        subject,
        content,
        process.env.MAILERLITE_FROM_EMAIL || "noreply@word2wallet.com",
        author.firstName || "Word2Wallet"
      );

      return {
        success: true,
        sentCount: results.success,
        failedCount: results.failed,
        errors: results.errors,
      };
    } catch (error) {
      console.error("Send new book notification error:", error);
      throw error;
    }
  }

  /**
   * Send "New Book" notification to readers of specific book(s)
   */
  static async sendNewBookNotificationToBookReaders(
    authorId: string,
    newBookId: string,
    targetBookIds: string[]
  ): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors: any[];
  }> {
    try {
      const newBook = await Book.findById(newBookId);
      if (!newBook) {
        throw new Error("Book not found");
      }

      const author = await User.findById({ _id: authorId });
      if (!author) {
        throw new Error("Author not found");
      }
      const authorName =
        author.firstName && author.lastName
          ? author.firstName + " " + author.lastName
          : "this author";

      // Get readers who downloaded specific books and subscribed to newsletter
      const readers = await EmailCapture.find({
        userId: authorId,
        bookId: { $in: targetBookIds },
        subscribedToNewsletter: true,
        isConfirmed: true,
        status: { $ne: "unsubscribed" },
      }).distinct("email");

      if (readers.length === 0) {
        console.log(`No newsletter subscribers found for specified books`);
        return {
          success: true,
          sentCount: 0,
          failedCount: 0,
          errors: [],
        };
      }

      console.log(
        `Sending new book notification to ${readers.length} targeted readers`
      );

      const subject = `📚 New Book Released: ${newBook.title}`;
      const content = this.buildNewBookEmailTemplate(newBook, author);

      const results = await MailerLiteService.sendBulkEmails(
        readers,
        subject,
        content,
        process.env.MAILERLITE_FROM_EMAIL || "noreply@word2wallet.com",
        authorName || "Word2Wallet"
      );

      return {
        success: true,
        sentCount: results.success,
        failedCount: results.failed,
        errors: results.errors,
      };
    } catch (error) {
      console.error("Send targeted new book notification error:", error);
      throw error;
    }
  }

  /**
   * Build new book email template
   */
  private static buildNewBookEmailTemplate(book: any, author: any): string {
    const authorName =
      author?.firstName && author?.lastName
        ? author.firstName + " " + author.lastName
        : "this author";
    const bookUrl = `${process.env.FRONTEND_URL}/books/${book._id}`;
    const coverImage = book.coverImageUrl || book.coverImageKey || "";
    const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Book Released</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: -0.5px;">
                📚 New Book Released!
              </h1>
              <p style="margin: 15px 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">
                ${
                  authorName || "Your favorite author"
                } just published a new book
              </p>
            </td>
          </tr>

          <!-- Book Cover -->
          ${
            coverImage
              ? `
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${coverImage}" alt="${book.title}" style="max-width: 300px; height: auto; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);" />
            </td>
          </tr>
          `
              : ""
          }

          <!-- Book Title -->
          <tr>
            <td style="padding: ${
              coverImage ? "20px" : "40px"
            } 40px 20px; text-align: center;">
              <h2 style="margin: 0; color: #1f2937; font-size: 28px; font-weight: bold;">
                ${book.title}
              </h2>
              ${
                book.author
                  ? `
              <p style="margin: 10px 0 0; color: #6b7280; font-size: 16px;">
                by ${book.author}
              </p>
              `
                  : ""
              }
            </td>
          </tr>

          <!-- Description -->
          ${
            book.description
              ? `
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
                ${book.description.substring(0, 200)}${
                  book.description.length > 200 ? "..." : ""
                }
              </p>
            </td>
          </tr>
          `
              : ""
          }

          <!-- CTA Button -->
          <tr>
            <td style="padding: 20px 40px 50px; text-align: center;">
              <a href="${bookUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                Get Your Copy Now
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <p style="margin: 0 0 15px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                You're receiving this email because you subscribed to ${authorName}'s newsletter.
              </p>
              <p style="margin: 0; font-size: 13px;">
                <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
                <span style="color: #d1d5db; margin: 0 8px;">|</span>
                <a href="${
                  process.env.FRONTEND_URL
                }" style="color: #667eea; text-decoration: none;">Visit Website</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Extra Footer -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Word2Wallet. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Get newsletter statistics for an author
   */
  static async getAuthorNewsletterStats(authorId: string): Promise<{
    totalSubscribers: number;
    confirmedSubscribers: number;
    subscribersByBook: any[];
  }> {
    const totalSubscribers = await EmailCapture.countDocuments({
      userId: authorId,
      subscribedToNewsletter: true,
      status: { $ne: "unsubscribed" },
    });

    const confirmedSubscribers = await EmailCapture.countDocuments({
      userId: authorId,
      subscribedToNewsletter: true,
      isConfirmed: true,
      status: { $ne: "unsubscribed" },
    });

    const subscribersByBook = await EmailCapture.aggregate([
      {
        $match: {
          userId: authorId,
          subscribedToNewsletter: true,
          status: { $ne: "unsubscribed" },
        },
      },
      {
        $group: {
          _id: "$bookId",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "books",
          localField: "_id",
          foreignField: "_id",
          as: "book",
        },
      },
      {
        $unwind: "$book",
      },
      {
        $project: {
          bookId: "$_id",
          bookTitle: "$book.title",
          subscriberCount: "$count",
        },
      },
      {
        $sort: { subscriberCount: -1 },
      },
    ]);

    return {
      totalSubscribers,
      confirmedSubscribers,
      subscribersByBook,
    };
  }
}
