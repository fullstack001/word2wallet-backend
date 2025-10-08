import * as fs from "fs";
import * as path from "path";
import { IChapter } from "../types";

export interface EpubGenerationOptions {
  title: string;
  description?: string;
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

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const epubContent = this.createEpubStructure({
      title,
      description,
      author,
      coverImagePath,
      chapters,
    });

    await this.writeEpubFile(epubContent, outputPath, coverImagePath);
    return outputPath;
  }

  /* ---------------------------------------------------------------------- */
  /* EPUB STRUCTURE                                                         */
  /* ---------------------------------------------------------------------- */

  private static createEpubStructure(options: {
    title: string;
    description?: string;
    author: string;
    coverImagePath?: string;
    chapters: IChapter[];
  }) {
    const { title, description, author, coverImagePath, chapters } = options;

    const mimetype = "application/epub+zip";

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const contentOpf = this.createContentOpf({
      title,
      description,
      author,
      coverImagePath,
      chapters,
    });

    const tocNcx = this.createTocNcx({ title, chapters }); // optional (back-compat)
    const navXhtml = this.createNavXhtml({ title, chapters });

    const styleCss = this.createStyleCss();

    const chapterFiles = this.createChapterFiles(chapters);

    return {
      mimetype,
      "META-INF/container.xml": containerXml,
      "OEBPS/content.opf": contentOpf,
      "OEBPS/toc.ncx": tocNcx,
      "OEBPS/nav.xhtml": navXhtml,
      "OEBPS/style.css": styleCss,
      ...chapterFiles,
    };
  }

  /**
   * content.opf (EPUB 3)
   */
  private static createContentOpf(options: {
    title: string;
    description?: string;
    author: string;
    coverImagePath?: string;
    chapters: IChapter[];
  }) {
    const { title, description, author, coverImagePath, chapters } = options;
    const uuid = this.generateUUID();

    let manifestItems = `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n`;
    manifestItems += `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;
    manifestItems += `    <item id="css" href="style.css" media-type="text/css"/>\n`;

    let spineItems = "";

    // Optional cover image
    if (coverImagePath && fs.existsSync(coverImagePath)) {
      const coverImageName = path.basename(coverImagePath);
      const ext = path.extname(coverImagePath).toLowerCase();
      const mimeType =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
          ? "image/png"
          : ext === ".svg"
          ? "image/svg+xml"
          : "image/jpeg";
      manifestItems += `    <item id="cover-image" href="images/${coverImageName}" media-type="${mimeType}" properties="cover-image"/>\n`;
    }

    // Chapters
    chapters.forEach((_, index) => {
      const id = `chapter-${index + 1}`;
      const file = `chapter-${index + 1}.xhtml`;
      manifestItems += `    <item id="${id}" href="${file}" media-type="application/xhtml+xml"/>\n`;
      spineItems += `    <itemref idref="${id}"/>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${this.escapeText(title)}</dc:title>
    <dc:creator>${this.escapeText(author)}</dc:creator>
    <dc:description>${this.escapeText(description || "")}</dc:description>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${this.iso8601Now()}</meta>
  </metadata>
  <manifest>
${manifestItems}  </manifest>
  <spine>
${spineItems}  </spine>
</package>`;
  }

  /**
   * toc.ncx (optional for back-compat)
   */
  private static createTocNcx(options: {
    title: string;
    chapters: IChapter[];
  }) {
    const { title, chapters } = options;
    const uuid = this.generateUUID();

    let navPoints = "";
    chapters.forEach((chapter, index) => {
      navPoints += `    <navPoint id="chap${index + 1}" playOrder="${
        index + 1
      }">
      <navLabel><text>${this.escapeText(chapter.title)}</text></navLabel>
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
  <docTitle><text>${this.escapeText(title)}</text></docTitle>
  <navMap>
${navPoints}  </navMap>
</ncx>`;
  }

  /**
   * nav.xhtml (EPUB 3 TOC)
   */
  private static createNavXhtml(options: {
    title: string;
    chapters: IChapter[];
  }) {
    const { title, chapters } = options;
    const items = chapters
      .map(
        (c, i) =>
          `<li><a href="chapter-${i + 1}.xhtml">${this.escapeText(
            c.title
          )}</a></li>`
      )
      .join("\n        ");

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8" />
  <title>${this.escapeText(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${this.escapeText(title)}</h1>
    <ol>
      ${items}
    </ol>
  </nav>
</body>
</html>`;
  }

  /**
   * style.css
   */
  private static createStyleCss(): string {
    return `body { font-family: Georgia, serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }
h2 { color: #34495e; margin-top: 30px; margin-bottom: 15px; }
h3 { color: #7f8c8d; margin-top: 25px; margin-bottom: 10px; }
p { margin-bottom: 15px; text-align: justify; }
img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
ul, ol { margin-bottom: 15px; padding-left: 30px; }
li { margin-bottom: 5px; }
pre, code { background: #f8f9fa; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }`;
  }

  /**
   * Chapter XHTML files (EPUB 3 XHTML5)
   */
  private static createChapterFiles(
    chapters: IChapter[]
  ): Record<string, string> {
    const files: Record<string, string> = {};

    chapters.forEach((chapter, index) => {
      const chapterNumber = index + 1;
      const filename = `OEBPS/chapter-${chapterNumber}.xhtml`;

      // Normalize raw fragment into strict XHTML-safe markup
      const normalized = this.normalizeXhtmlFragment(chapter.content || "");

      files[filename] = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8" />
  <title>${this.escapeText(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>Chapter ${chapterNumber}: ${this.escapeText(chapter.title)}</h1>
  ${
    chapter.description
      ? `<h2>${this.escapeText(chapter.description)}</h2>`
      : ""
  }
  <div class="content">
${normalized}
  </div>
</body>
</html>`;
    });

    return files;
  }

  /**
   * ZIP -> .epub
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
      output.on("close", () => resolve());
      archive.on("error", (err: Error) => reject(err));
      archive.pipe(output);

      // 1) mimetype MUST be first and uncompressed
      archive.append(content.mimetype, { name: "mimetype", store: true });

      // 2) other files
      Object.entries(content).forEach(([filepath, data]) => {
        if (filepath !== "mimetype") {
          archive.append(data, { name: filepath });
        }
      });

      // 3) cover image (if any)
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

  /* ---------------------------------------------------------------------- */
  /* HELPERS                                                                */
  /* ---------------------------------------------------------------------- */

  private static iso8601Now(): string {
    // EPUB wants second precision
    const d = new Date();
    d.setMilliseconds(0);
    return d.toISOString();
  }

  /** Escape pure text content for XML nodes (never try to fix tags here). */
  private static escapeText(text: string): string {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Normalize an HTML fragment to XML-compliant XHTML:
   * - strip <script>/<style>
   * - unwrap media from <p> containers
   * - self-close void elements (img, br, hr, source, etc.)
   * - remove stray </p>
   * - ensure <source> tags are self-closed with type/src kept
   */
  private static normalizeXhtmlFragment(html: string): string {
    if (!html) return "";

    let out = html;

    // Remove <script> and <style> blocks completely
    out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
    out = out.replace(/<style[\s\S]*?<\/style>/gi, "");

    // Trim BOM / weird whitespace
    out = out.replace(/^\uFEFF/, "").trim();

    // Unwrap media from <p> containers (img/video/audio)
    const unwrap = (tag: string) => {
      const re = new RegExp(
        `<p\\b[^>]*>\\s*(<${tag}\\b[\\s\\S]*?>[\\s\\S]*?<\\/${tag}>|<${tag}\\b[^>]*?/>)\\s*</p>`,
        "gi"
      );
      let prev: string;
      do {
        prev = out;
        out = out.replace(re, "$1");
      } while (out !== prev);
    };
    ["img", "video", "audio"].forEach(unwrap);

    // Self-close void elements if not already closed
    const voidTags = [
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr",
    ];
    for (const tag of voidTags) {
      // <tag ...>  (not followed by / or > already closed)
      const re = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
      out = out.replace(re, (m) =>
        m.endsWith("/>") ? m : m.replace(/>$/, " />")
      );
    }

    // Ensure <source> always has /> (covered above) and keep attributes
    // Remove duplicate stray </p> tags produced by editors
    out = out.replace(/<\/p>\s*<\/p>/gi, "</p>");

    // Common broken pattern: <p> ... </p></p>  -> </p>
    out = out.replace(/<\/p>\s*<\/p>/gi, "</p>");

    // Remove empty paragraphs introduced by cleanups: <p>\s*</p>
    out = out.replace(/<p\b[^>]*>\s*<\/p>/gi, "");

    // Collapse multiple line breaks
    out = out.replace(/\r\n/g, "\n");

    // Final trim of lines
    out = out
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n");

    return out;
  }

  /** RFC4122-ish UUID v4 */
  private static generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
