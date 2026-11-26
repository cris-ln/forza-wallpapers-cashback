import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";

import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

import {
  FWC_MINT,
  FWC_RESERVA,
  obtenerATAFWC,
} from "./cashback";

import {
  PROGRAM_ID,
  obtenerPrograma,
} from "./acciones";

/**
 * Compra atómica:
 * - Crea el ATA FWC del comprador si todavía no existe.
 * - Envía el precio SOL directamente al creador.
 * - Entrega el cashback desde la reserva central.
 * - Registra la compra en la blockchain.
 *
 * Todas las operaciones se ejecutan en una sola transacción
 * y requieren una sola firma del comprador.
 */
export async function comprarWallpaper(
  connection: Connection,
  wallet: AnchorWallet,
  wallpaper: PublicKey,
  creador: PublicKey
): Promise<string> {
  const comprador = wallet.publicKey;

  if (comprador.equals(creador)) {
    throw new Error("No puedes comprar tu propio wallpaper.");
  }

  // Identificador único de esta compra.
  const purchaseId = crypto.getRandomValues(new Uint8Array(32));

  // PDA del registro de compra.
  const [cashbackRecord] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("cashback"),
      Buffer.from(purchaseId),
    ],
    PROGRAM_ID
  );

  // PDA de configuración de cashback.
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("cashback_config")],
    PROGRAM_ID
  );

  // PDA PermanentDelegate del token FWC.
  const [fwcDelegate] = PublicKey.findProgramAddressSync(
    [Buffer.from("fwc_delegate")],
    PROGRAM_ID
  );

  // ATA del comprador bajo Token-2022.
  const buyerTokenAccount = obtenerATAFWC(comprador);

  // El comprador paga la creación de su propia cuenta ATA.
  const crearATA = createAssociatedTokenAccountIdempotentInstruction(
    comprador,
    buyerTokenAccount,
    comprador,
    FWC_MINT,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const programa = obtenerPrograma(connection, wallet);

  // La instrucción on-chain realiza el pago SOL y el cashback.
  const firma = await (programa.methods as any)
    .registrarCashback(Array.from(purchaseId))
    .accounts({
      cashbackRecord,
      buyer: comprador,
      wallpaper,
      creator: creador,
      config,
      fwcDelegate,
      mint: FWC_MINT,
      reserve: FWC_RESERVA,
      buyerTokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([crearATA])
    .rpc();

  const confirmacion = await connection.confirmTransaction(
    firma,
    "confirmed"
  );

  if (confirmacion.value.err) {
    throw new Error("La compra no pudo confirmarse en Solana Devnet.");
  }

  return firma;
}
