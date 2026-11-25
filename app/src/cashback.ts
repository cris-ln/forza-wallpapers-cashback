import {
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";

import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

// Configuración del token FWC en Devnet.
export const FWC_MINT = new PublicKey(
  "BHmHxWzpg21tWeaAtu4i4ywUkLa32CDoVUrbrjCyEomH"
);

export const FWC_ADMIN = new PublicKey(
  "HKKExXwZ27B3AR5AGS6Kmw4GunJ9NjYD3KARWWKGZcEj"
);

export const FWC_RESERVA = new PublicKey(
  "ASYFV24iksv9HG14JG3fe4NTLp7g6BtzQtjzAYjSgNo3"
);

export const FWC_DECIMALES = 2;
export const FWC_RECOMPENSA_INICIAL = 10;

const CLAVE_RECOMPENSA =
  `forza-wallpapers-fwc-recompensa-${FWC_ADMIN.toBase58()}`;

export function obtenerRecompensaFWC(): number {
  try {
    const guardada = localStorage.getItem(CLAVE_RECOMPENSA);

    if (guardada === null) {
      return FWC_RECOMPENSA_INICIAL;
    }

    const cantidad = Number(guardada);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return FWC_RECOMPENSA_INICIAL;
    }

    const unidades = cantidad * 10 ** FWC_DECIMALES;

    return Number.isSafeInteger(unidades)
      ? cantidad
      : FWC_RECOMPENSA_INICIAL;
  } catch {
    return FWC_RECOMPENSA_INICIAL;
  }
}

export function guardarRecompensaFWC(cantidad: number): void {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("La recompensa debe ser mayor que cero.");
  }

  const unidades = cantidad * 10 ** FWC_DECIMALES;

  if (!Number.isSafeInteger(unidades)) {
    throw new Error("La recompensa admite como máximo dos decimales.");
  }

  localStorage.setItem(CLAVE_RECOMPENSA, String(cantidad));
}

export function fwcABase(cantidad: number): bigint {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad de FWC debe ser mayor que cero.");
  }

  const unidades = cantidad * 10 ** FWC_DECIMALES;

  if (!Number.isSafeInteger(unidades)) {
    throw new Error("La cantidad admite como máximo dos decimales.");
  }

  return BigInt(unidades);
}

export function obtenerATAFWC(comprador: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    FWC_MINT,
    comprador,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

/**
 * Prepara únicamente la creación idempotente del ATA.
 * La transferencia FWC la ejecuta el programa Anchor.
 */
export function crearInstruccionesCashback(
  comprador: PublicKey
): {
  cuentaDestino: PublicKey;
  instrucciones: TransactionInstruction[];
} {
  const cuentaDestino = obtenerATAFWC(comprador);

  const crearATA = createAssociatedTokenAccountIdempotentInstruction(
    FWC_ADMIN,
    cuentaDestino,
    comprador,
    FWC_MINT,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return {
    cuentaDestino,
    instrucciones: [crearATA],
  };
}
