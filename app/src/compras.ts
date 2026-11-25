import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import type { WalletContextState } from "@solana/wallet-adapter-react";
import type BN from "bn.js";

/**
 * Realiza el pago de un wallpaper directamente al creador.
 *
 * El comprador firma y paga la transacción.
 * El dinero llega directamente a la wallet del creador.
 *
 * El cashback se procesa posteriormente mediante
 * una operación independiente aprobada por la administradora.
 */
export async function comprarWallpaper(
  connection: Connection,
  wallet: WalletContextState,
  creador: PublicKey,
  precioLamports: BN
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error("Conecta tu wallet para comprar este wallpaper.");
  }

  if (wallet.publicKey.equals(creador)) {
    throw new Error("No puedes comprar tu propio wallpaper.");
  }

  const lamports = Number(precioLamports.toString());

  if (!Number.isSafeInteger(lamports) || lamports <= 0) {
    throw new Error("El precio del wallpaper no es válido.");
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaccion = new Transaction();

  transaccion.feePayer = wallet.publicKey;
  transaccion.recentBlockhash = blockhash;

  transaccion.add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: creador,
      lamports,
    })
  );

  const firma = await wallet.sendTransaction(
    transaccion,
    connection
  );

  const confirmacion = await connection.confirmTransaction(
    {
      signature: firma,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed"
  );

  if (confirmacion.value.err) {
    throw new Error("El pago no pudo confirmarse en Solana Devnet.");
  }

  return firma;
}

/**
 * Verifica un pago de wallpaper en Solana Devnet.
 *
 * Comprueba:
 * 1. Que la transacción exista y esté confirmada.
 * 2. Que no haya terminado con errores.
 * 3. Que el comprador haya firmado.
 * 4. Que exista una transferencia System Program
 *    por el importe exacto al creador indicado.
 *
 * No entrega cashback ni registra compras.
 */
export async function verificarPagoWallpaper(
  connection: Connection,
  firma: string,
  comprador: PublicKey,
  creador: PublicKey,
  precioLamports: BN
): Promise<boolean> {
  const importeEsperado = BigInt(precioLamports.toString());

  if (importeEsperado <= 0n) {
    return false;
  }

  const transaccion = await connection.getParsedTransaction(
    firma,
    {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    }
  );

  if (!transaccion || transaccion.meta?.err) {
    return false;
  }

  const compradorFirmo = transaccion.transaction.message.accountKeys.some(
    (cuenta) =>
      cuenta.pubkey.equals(comprador) && cuenta.signer
  );

  if (!compradorFirmo) {
    return false;
  }

  const instrucciones =
    transaccion.transaction.message.instructions;

  for (const instruccion of instrucciones) {
    if (!("parsed" in instruccion)) {
      continue;
    }

    const datos = instruccion.parsed as {
      type?: string;
      info?: {
        source?: string;
        destination?: string;
        lamports?: number | string;
      };
    };

    if (
      instruccion.program === "system" &&
      datos.type === "transfer" &&
      datos.info?.source === comprador.toBase58() &&
      datos.info?.destination === creador.toBase58() &&
      datos.info?.lamports !== undefined &&
      BigInt(String(datos.info.lamports)) === importeEsperado
    ) {
      return true;
    }
  }

  return false;
}