declare module "bs58" {
  export function encode(
    input: Uint8Array
  ): string;

  export function decode(
    input: string
  ): Uint8Array;

  export function decodeUnsafe(
    input: string
  ): Uint8Array | undefined;
}