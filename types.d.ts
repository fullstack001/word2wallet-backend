declare module "epub-parser" {
  export function open(
    filename: string,
    callback: (error: any, epub: any) => void
  ): void;
  export function getZip(filename: string): any;
  export function getJsZip(filename: string): any;
  export function extractBinary(filename: string, path: string): any;
  export function extractText(filename: string, path: string): any;
}
