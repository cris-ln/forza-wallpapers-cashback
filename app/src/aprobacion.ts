import {
  Connection,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

import type { AnchorWallet } from "@solana/wallet-adapter-react";
import BN from "bn.js";
import { Buffer } from "buffer";

import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  FWC_ADMIN,
  FWC_MINT,
  FWC_RESERVA,
  crearInstruccionesCashback,
  obtenerRecompensaFWC,
  fwcABase,
} from "./cashback";

import {
  PROGRAM_ID,
  obtenerPrograma,
} from "./acciones";

import { verificarPagoWallpaper } from "./compras";

const CLAVE_COMPRAS_RECOMPENSADAS =
  `forza-wallpapers-compras-recompensadas-${FWC_ADMIN.toBase58()}`;

/**
 * Guarda un historial informativo local.
 * La protección real contra duplicados es el PDA on-chain.
 */
function registrarCompraRecompensada(
  firmaPago: string,
  firmaCashback: string
): void {
  try {
    const registro = localStorage.getItem(
      CLAVE_COMPRAS_RECOMPENSADAS
    );

    const firmas: string[] = registro
      ? JSON.parse(registro)
      : [];

    if (!firmas.includes(firmaPago)) {
      firmas.push(firmaPago);
    }

    localStorage.setItem(
      CLAVE_COMPRAS_RECOMPENSADAS,
      JSON.stringify(firmas)
    );

    localStorage.setItem(
      `forza-wallpapers-cashback-${firmaPago}`,
      firmaCashback
    );
  } catch {
    // El historial local no afecta la confirmación on-chain.
  }
}

/**
 * Aprueba y entrega el cashback mediante el programa Anchor.
 */
export async function aprobarCashback(
  connection: Connection,
  wallet: AnchorWallet,
  firmaPago: string,
  comprador: PublicKey,
  creador: PublicKey,
  precioLamports: BN
): Promise<{
  firmaCashback: string;
  cantidadFWC: number;
}> {
  if (!wallet.publicKey.equals(FWC_ADMIN)) {
    throw new Error(
      "La wallet conectada no tiene autorización para entregar FWC."
    );
  }

  if (!firmaPago.trim()) {
    throw new Error("Introduce la firma del pago.");
  }

  if (precioLamports.lten(0)) {
    throw new Error("El precio de la compra no es válido.");
  }

  const pagoValido = await verificarPagoWallpaper(
    connection,
    firmaPago.trim(),
    comprador,
    creador,
    precioLamports
  );

  if (!pagoValido) {
    throw new Error(
      "No se pudo verificar el pago. No se entregará el cashback."
    );
  }

  // Identificador determinista de la compra.
  // Una misma firma siempre produce el mismo PDA.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(firmaPago.trim())
  );

  const purchaseId = new Uint8Array(digest);

  const [cashbackRecord] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("cashback"),
      Buffer.from(purchaseId),
    ],
    PROGRAM_ID
  );

  const cantidadFWC = obtenerRecompensaFWC();
  const cantidadBase = fwcABase(cantidadFWC);

  const resultado = crearInstruccionesCashback(comprador);

  const programa = obtenerPrograma(connection, wallet);

  // La creación del ATA y el registro + transferencia
  // se envían en una sola transacción.
  const firmaCashback = await (programa.methods as any)
    .registrarCashback(
      Array.from(purchaseId),
      new BN(precioLamports.toString()),
      new BN(cantidadBase.toString())
    )
    .accounts({
      admin: FWC_ADMIN,
      cashbackRecord,
      buyer: comprador,
      creator: creador,
      mint: FWC_MINT,
      reserve: FWC_RESERVA,
      buyerTokenAccount: resultado.cuentaDestino,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions(resultado.instrucciones)
    .rpc();

  const confirmacion = await connection.confirmTransaction(
    firmaCashback,
    "confirmed"
  );

  if (confirmacion.value.err) {
    throw new Error(
      "La transacción de cashback no pudo confirmarse."
    );
  }

  registrarCompraRecompensada(
    firmaPago,
    firmaCashback
  );

  return {
    firmaCashback,
    cantidadFWC,
  };
}
