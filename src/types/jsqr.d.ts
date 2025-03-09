declare module 'jsqr' {
    export interface QRCode {
        data: string;
        version: number;
        format: string;
        // Add other properties as needed
    }

    export function jsQR(
        data: Uint8ClampedArray,
        width: number,
        height: number,
        options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' }
    ): QRCode | null;

    export = jsQR; // Use export = for CommonJS compatibility
}
