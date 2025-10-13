import * as fs from "fs";
import * as path from "path";
import { IChapter } from "../types";

// Since we don't have puppeteer yet, we'll use a simpler approach with html-pdf-node
// Or we can use pdf-lib for programmatic PDF generation
// For now, let's create a structure that will work with puppeteer when installed

export interface PdfGenerationOptions {
  title: string;
  description?: string;
  author: string;
  chapters: IChapter[];
  outputPath: string;
}

export class PdfGenerator {
  /**
   * Generate PDF file from book data
   */
  static async generatePdf(options: PdfGenerationOptions): Promise<string> {
    const { title, description, author, chapters, outputPath } = options;

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create HTML content for the PDF
    const htmlContent = this.createHtmlContent({
      title,
      description,
      author,
      chapters,
    });

    // Try to use puppeteer if available, otherwise use a simple HTML file
    try {
      // Check if puppeteer is available
      const puppeteer = require("puppeteer");
      await this.generateWithPuppeteer(htmlContent, outputPath);
    } catch (error) {
      console.warn("Puppeteer not available, using fallback PDF generation");
      // Fallback: write HTML file and inform that puppeteer is needed
      const htmlPath = outputPath.replace(".pdf", ".html");
      fs.writeFileSync(htmlPath, htmlContent);
      throw new Error(
        "PDF generation requires puppeteer. Please install it: npm install puppeteer"
      );
    }

    return outputPath;
  }

  /**
   * Generate PDF using Puppeteer
   */
  private static async generateWithPuppeteer(
    htmlContent: string,
    outputPath: string
  ): Promise<void> {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
      });

      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "20mm",
          left: "20mm",
        },
      });
    } finally {
      await browser.close();
    }
  }

  /**
   * Create HTML content for PDF
   */
  private static createHtmlContent(options: {
    title: string;
    description?: string;
    author: string;
    chapters: IChapter[];
  }): string {
    const { title, description, author, chapters } = options;

    const chaptersHtml = chapters
      .map((chapter, index) => {
        const chapterNumber = index + 1;
        return `
        <div class="chapter" ${
          chapterNumber > 1 ? 'style="page-break-before: always;"' : ""
        }>
          <h2 class="chapter-title">Chapter ${chapterNumber}: ${this.escapeHtml(
          chapter.title
        )}</h2>
          ${
            chapter.description
              ? `<h3 class="chapter-description">${this.escapeHtml(
                  chapter.description
                )}</h3>`
              : ""
          }
          <div class="chapter-content">
            ${chapter.content || ""}
          </div>
        </div>
      `;
      })
      .join("\n");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    @page {
      margin: 20mm;
    }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 0;
    }
    
    .title-page {
      text-align: center;
      padding: 100px 0;
      page-break-after: always;
    }
    
    .book-title {
      font-size: 32pt;
      font-weight: bold;
      margin-bottom: 20px;
      color: #1a1a1a;
    }
    
    .book-description {
      font-size: 14pt;
      color: #666;
      margin-bottom: 40px;
      font-style: italic;
    }
    
    .book-author {
      font-size: 16pt;
      color: #333;
      margin-top: 40px;
    }
    
    .chapter {
      margin-bottom: 40px;
    }
    
    .chapter-title {
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 10px;
      color: #1a1a1a;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    
    .chapter-description {
      font-size: 14pt;
      color: #666;
      font-style: italic;
      margin-bottom: 20px;
    }
    
    .chapter-content {
      text-align: justify;
    }
    
    .chapter-content p {
      margin-bottom: 1em;
    }
    
    .chapter-content h1,
    .chapter-content h2,
    .chapter-content h3,
    .chapter-content h4,
    .chapter-content h5,
    .chapter-content h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: #1a1a1a;
    }
    
    .chapter-content ul,
    .chapter-content ol {
      margin: 1em 0;
      padding-left: 2em;
    }
    
    .chapter-content li {
      margin-bottom: 0.5em;
    }
    
    .chapter-content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1em auto;
    }
    
    .chapter-content blockquote {
      border-left: 4px solid #ccc;
      padding-left: 1em;
      margin: 1em 0;
      font-style: italic;
      color: #666;
    }
    
    .chapter-content code {
      background-color: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    .chapter-content pre {
      background-color: #f5f5f5;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
      margin: 1em 0;
    }
    
    .chapter-content pre code {
      background-color: transparent;
      padding: 0;
    }
    
    .chapter-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    
    .chapter-content th,
    .chapter-content td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    
    .chapter-content th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="title-page">
    <h1 class="book-title">${this.escapeHtml(title)}</h1>
    ${
      description
        ? `<p class="book-description">${this.escapeHtml(description)}</p>`
        : ""
    }
    <p class="book-author">By ${this.escapeHtml(author)}</p>
  </div>
  
  ${chaptersHtml}
</body>
</html>
    `;
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
