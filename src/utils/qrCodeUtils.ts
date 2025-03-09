import QRCode from 'qrcode';

export const generateHighQualityQRCode = async (data: string): Promise<string> => {
  try {
    // Generate QR code as SVG
    const qrSvg = await QRCode.toString(data, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
      scale: 10,
      width: 512
    });
    
    // Convert SVG to data URL
    const svgBlob = new Blob([qrSvg], { type: 'image/svg+xml' });
    return URL.createObjectURL(svgBlob);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};