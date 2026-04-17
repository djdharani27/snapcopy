declare module "qrcode" {
  interface QRCodeToBufferOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    scale?: number;
    type?: "png";
    width?: number;
  }

  const QRCode: {
    toBuffer(
      text: string,
      options?: QRCodeToBufferOptions,
    ): Promise<Buffer>;
  };

  export default QRCode;
}
