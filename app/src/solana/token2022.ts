import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMint2Instruction,
  createInitializePermanentDelegateInstruction,
  createMintToCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from "@solana/spl-token";

import {
  createInitializeInstruction,
  pack,
} from "@solana/spl-token-metadata";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export const FWC_ADMIN = new PublicKey(
  "HKKExXwZ27B3AR5AGS6Kmw4GunJ9NjYD3KARWWKGZcEj"
);

export const FWC_DELEGATE = new PublicKey(
  "HQDYkoaoRaE85unoQxLPoE13mdKtJriUdzCvpZr3oQDz"
);

export const FWC_DECIMALES = 2;
export const FWC_RESERVA_INICIAL = 1_000_000;
export const FWC_RESERVA_BASE = 100_000_000n;

export async function crearTransaccionNuevoFWC(
  connection: Connection,
  admin: PublicKey
) {
  if (!admin.equals(FWC_ADMIN)) {
    throw new Error("Conecta la wallet administradora HKK para crear el token.");
  }

  const mint = Keypair.generate();

  const metadata = {
    updateAuthority: admin,
    mint: mint.publicKey,
    name: "Forza Rewards",
    symbol: "FWC",
    uri: "",
    additionalMetadata: [],
  };

  const metadataSize = 4 + pack(metadata).length;

  // TokenMetadata es de tamaño variable: reservamos su encabezado TLV
  // (4 bytes) y el contenido empaquetado calculado anteriormente.
  // Reservamos espacio adicional para la estructura de extensiones
  // de Token-2022 y los metadatos variables.
  // Espacio exacto para las extensiones previas a InitializeMint2.
  const mintSpace = getMintLen([
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ]);

  // La renta contempla también los metadatos que se agregan después.
  const rent = await connection.getMinimumBalanceForRentExemption(
    mintSpace + metadataSize
  );

  const reserva = getAssociatedTokenAddressSync(
    mint.publicKey,
    admin,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const tx = new Transaction();

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: admin,
      newAccountPubkey: mint.publicKey,
      lamports: rent,
      space: mintSpace,
      programId: TOKEN_2022_PROGRAM_ID,
    }),

    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      admin,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),

    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      FWC_DELEGATE,
      TOKEN_2022_PROGRAM_ID
    ),

    createInitializeMint2Instruction(
      mint.publicKey,
      FWC_DECIMALES,
      admin,
      null,
      TOKEN_2022_PROGRAM_ID
    ),

    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint.publicKey,
      updateAuthority: admin,
      mintAuthority: admin,
      mint: mint.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    }),

    createAssociatedTokenAccountInstruction(
      admin,
      reserva,
      admin,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),

    createMintToCheckedInstruction(
      mint.publicKey,
      reserva,
      admin,
      FWC_RESERVA_BASE,
      FWC_DECIMALES,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  return {
    transaction: tx,
    mint,
    reserva,
    mintSpace,
    rent,
  };
}
