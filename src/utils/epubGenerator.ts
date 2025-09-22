import * as fs from "fs";
import * as path from "path";
import { IChapter, EpubMetadata } from "../types";

export interface EpubGenerationOptions {
  title: string;
  description: string;
  author: string;
  coverImagePath?: string;
  chapters: IChapter[];
  outputPath: string;
}

export class EpubGenerator {
  /**
   * Generate EPUB file from course data
   */
  static async generateEpub(options: EpubGenerationOptions): Promise<string> {
    const { title, description, author, coverImagePath, chapters, outputPath } =
      options;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create EPUB content structure
    const epubContent = this.createEpubStructure({
      title,
      description,
      author,
      coverImagePath,
      chapters,
    });

    // Write EPUB file
    await this.writeEpubFile(epubContent, outputPath, coverImagePath);

    return outputPath;
  }

  /**
   * Create EPUB file structure
   */
  private static createEpubStructure(options: {
    title: string;
    description: string;
    author: string;
    coverImagePath?: string;
    chapters: IChapter[];
  }) {
    const { title, description, author, coverImagePath, chapters } = options;

    // Create mimetype file
    const mimetype = "application/epub+zip";

    // Create META-INF/container.xml
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    // Create OEBPS/content.opf
    const contentOpf = this.createContentOpf({
      title,
      description,
      author,
      coverImagePath,
      chapters,
    });

    // Create OEBPS/toc.ncx
    const tocNcx = this.createTocNcx({ title, chapters });

    // Create OEBPS/style.css
    const styleCss = this.createStyleCss();

    // Create chapter HTML files
    const chapterFiles = this.createChapterFiles(chapters);

    return {
      mimetype,
      "META-INF/container.xml": containerXml,
      "OEBPS/content.opf": contentOpf,
      "OEBPS/toc.ncx": tocNcx,
      "OEBPS/style.css": styleCss,
      ...chapterFiles,
    };
  }

  /**
   * Create content.opf file
   */
  private static createContentOpf(options: {
    title: string;
    description: string;
    author: string;
    coverImagePath?: string;
    chapters: IChapter[];
  }) {
    const { title, description, author, coverImagePath, chapters } = options;
    const uuid = this.generateUUID();

    let manifestItems = "";
    let spineItems = "";
    let coverImageItem = "";

    // Add cover image if exists
    if (coverImagePath && fs.existsSync(coverImagePath)) {
      const coverImageName = path.basename(coverImagePath);
      const coverImageExt = path.extname(coverImagePath).toLowerCase();
      const mimeType =
        coverImageExt === ".jpg" || coverImageExt === ".jpeg"
          ? "image/jpeg"
          : coverImageExt === ".png"
          ? "image/png"
          : "image/jpeg";

      coverImageItem = `    <item id="cover-image" href="images/${coverImageName}" media-type="${mimeType}" properties="cover-image"/>`;
      manifestItems += coverImageItem + "\n";
    }

    // Add chapters
    chapters.forEach((chapter, index) => {
      const chapterId = `chapter-${index + 1}`;
      const chapterFile = `chapter-${index + 1}.xhtml`;

      manifestItems += `    <item id="${chapterId}" href="${chapterFile}" media-type="application/xhtml+xml"/>\n`;
      spineItems += `    <itemref idref="${chapterId}"/>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${this.escapeXml(title)}</dc:title>
    <dc:creator>${this.escapeXml(author)}</dc:creator>
    <dc:description>${this.escapeXml(description)}</dc:description>
    <dc:language>en</dc:language>
    <dc:date>${new Date().toISOString()}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
    ${coverImagePath ? '<meta name="cover" content="cover-image"/>' : ""}
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
${manifestItems}  </manifest>
  <spine toc="ncx">
${spineItems}  </spine>
</package>`;
  }

  /**
   * Create toc.ncx file
   */
  private static createTocNcx(options: {
    title: string;
    chapters: IChapter[];
  }) {
    const { title, chapters } = options;
    const uuid = this.generateUUID();

    let navPoints = "";
    chapters.forEach((chapter, index) => {
      const chapterId = `chapter-${index + 1}`;
      const playOrder = index + 1;

      navPoints += `    <navPoint id="${chapterId}" playOrder="${playOrder}">
      <navLabel>
        <text>${this.escapeXml(chapter.title)}</text>
      </navLabel>
      <content src="chapter-${index + 1}.xhtml"/>
    </navPoint>
`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${this.escapeXml(title)}</text>
  </docTitle>
  <navMap>
${navPoints}  </navMap>
</ncx>`;
  }

  /**
   * Create style.css file
   */
  private static createStyleCss(): string {
    return `body {
  font-family: Georgia, serif;
  line-height: 1.6;
  margin: 0;
  padding: 20px;
  color: #333;
}

h1 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

h2 {
  color: #34495e;
  margin-top: 30px;
  margin-bottom: 15px;
}

h3 {
  color: #7f8c8d;
  margin-top: 25px;
  margin-bottom: 10px;
}

p {
  margin-bottom: 15px;
  text-align: justify;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 20px auto;
}

blockquote {
  border-left: 4px solid #3498db;
  margin: 20px 0;
  padding-left: 20px;
  font-style: italic;
  color: #555;
}

ul, ol {
  margin-bottom: 15px;
  padding-left: 30px;
}

li {
  margin-bottom: 5px;
}

code {
  background-color: #f8f9fa;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

pre {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
  overflow-x: auto;
  margin: 20px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

th {
  background-color: #f2f2f2;
  font-weight: bold;
}`;
  }

  /**
   * Create chapter HTML files
   */
  private static createChapterFiles(
    chapters: IChapter[]
  ): Record<string, string> {
    const files: Record<string, string> = {};

    chapters.forEach((chapter, index) => {
      const chapterNumber = index + 1;
      const filename = `OEBPS/chapter-${chapterNumber}.xhtml`;

      files[filename] = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${this.escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>Chapter ${chapterNumber}: ${this.escapeXml(chapter.title)}</h1>
  <h2>${this.escapeXml(chapter.description)}</h2>
  <div class="content">
    ${chapter.content}
  </div>
</body>
</html>`;
    });

    return files;
  }

  /**
   * Write EPUB file using archiver
   */
  private static async writeEpubFile(
    content: Record<string, string>,
    outputPath: string,
    coverImagePath?: string
  ): Promise<void> {
    const archiver = require("archiver");
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on("close", () => {
        resolve();
      });

      archive.on("error", (err: Error) => {
        reject(err);
      });

      archive.pipe(output);

      // Add mimetype file (must be first and uncompressed)
      archive.append(content.mimetype, { name: "mimetype", store: true });

      // Add other files
      Object.entries(content).forEach(([filepath, content]) => {
        if (filepath !== "mimetype") {
          archive.append(content, { name: filepath });
        }
      });

      // Add cover image if exists
      if (coverImagePath && fs.existsSync(coverImagePath)) {
        const coverImageName = path.basename(coverImagePath);
        const coverImageStream = fs.createReadStream(coverImagePath);
        archive.append(coverImageStream, {
          name: `OEBPS/images/${coverImageName}`,
        });
      }

      archive.finalize();
    });
  }

  /**
   * Generate UUID
   */
  private static generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Escape XML special characters
   */
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
