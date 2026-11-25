import {
  Program,
  AnchorProvider,
  BorshAccountsCoder,
} from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { encode as bs58Encode } from "bs58";
import BN from "bn.js";
import { Buffer } from "buffer";
import IDL from "./idl/forza_wallpapers.json";

// Dirección del programa en Devnet
export const PROGRAM_ID = new PublicKey(
  "CpvzJ6dcKsmfZMAnmhyx8vs3H8UjEbQnnzzPN1b7RDcC"
);

export const DEVNET_RPC = "https://api.devnet.solana.com";

// Discriminador de la cuenta Galeria obtenido del IDL
const GALERIA_DISCRIMINATOR = [
  161, 205, 52, 51, 161, 19, 187, 236,
];

// Estructura de una galería
export interface GaleriaData {
  publicKey: PublicKey;
  owner: PublicKey;
  nombreGaleria: string;
  totalWallpapers: number;
}

// Estructura de un wallpaper
export interface WallpaperCatalogo {
  publicKey: PublicKey;
  galeria: PublicKey;
  owner: PublicKey;
  id: number;
  titulo: string;
  juego: string;
  urlImagen: string;
  precioLamports: BN;
  descargas: number;
}

// Conectar con el programa
export function obtenerPrograma(
  connection: Connection,
  wallet: AnchorWallet
) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  return new Program(IDL as Idl, provider);
}

// Calcular PDA de la galería
export async function calcularPdaGaleria(owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("galeria"), owner.toBuffer()],
    PROGRAM_ID
  );
}

// Calcular PDA del wallpaper
export async function calcularPdaWallpaper(
  galeria: PublicKey,
  id: number
) {
  const idBytes = new BN(id).toArrayLike(Buffer, "le", 8);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("wallpaper"),
      galeria.toBuffer(),
      idBytes,
    ],
    PROGRAM_ID
  );
}

// Convertir SOL a lamports
export function solALamports(sol: string): BN {
  if (!/^\d+(\.\d{1,9})?$/.test(sol.trim())) {
    throw new Error("Introduce un precio válido en SOL.");
  }

  const [entero, decimal = ""] = sol.trim().split(".");

  const lamports =
    BigInt(entero) * 1_000_000_000n +
    BigInt(decimal.padEnd(9, "0"));

  return new BN(lamports.toString());
}

// Convertir lamports a SOL
export function lamportsASol(
  lamports: BN | number | string
): string {
  const valor = new BN(lamports.toString());
  const entero = valor.div(new BN("1000000000"));
  const decimal = valor.mod(new BN("1000000000"));

  return `${entero.toString()}.${decimal
    .toString()
    .padStart(9, "0")}`;
}

// Crear galería
export async function crearGaleria(
  connection: Connection,
  wallet: AnchorWallet,
  nombre: string
): Promise<string> {
  if (Buffer.byteLength(nombre, "utf8") > 30 || !nombre.trim()) {
    throw new Error("El nombre debe tener entre 1 y 30 bytes.");
  }

  const programa = obtenerPrograma(connection, wallet);
  const [galeria] = await calcularPdaGaleria(wallet.publicKey);

  const tx = await (programa.methods as any)
    .crearGaleria(nombre.trim())
    .accounts({
      galeria,
      owner: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return `Galería creada correctamente. Transacción: ${tx}`;
}

// Publicar wallpaper
export async function publicarWallpaper(
  connection: Connection,
  wallet: AnchorWallet,
  titulo: string,
  juego: string,
  urlImagen: string,
  precio: BN
): Promise<string> {
  if (Buffer.byteLength(titulo, "utf8") > 30 || !titulo.trim()) {
    throw new Error("El título debe tener entre 1 y 30 bytes.");
  }

  if (Buffer.byteLength(juego, "utf8") > 20 || !juego.trim()) {
    throw new Error("El nombre del juego debe tener entre 1 y 20 bytes.");
  }

  if (Buffer.byteLength(urlImagen, "utf8") > 80 || !urlImagen.trim()) {
    throw new Error("La URL debe tener entre 1 y 80 bytes.");
  }

  const programa = obtenerPrograma(connection, wallet);
  const [galeria] = await calcularPdaGaleria(wallet.publicKey);

  const cuentaGaleria: any = await (programa.account as any)
    .galeria.fetch(galeria);

  const id = Number(cuentaGaleria.totalWallpapers.toString());

  const [wallpaper] = await calcularPdaWallpaper(galeria, id);

  const tx = await (programa.methods as any)
    .publicarWallpaper(
      titulo.trim(),
      juego.trim(),
      urlImagen.trim(),
      precio
    )
    .accounts({
      galeria,
      wallpaper,
      owner: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return `Wallpaper publicado correctamente. Transacción: ${tx}`;
}

// Actualizar precio
export async function actualizarPrecio(
  connection: Connection,
  wallet: AnchorWallet,
  id: number,
  nuevoPrecio: BN
): Promise<string> {
  const programa = obtenerPrograma(connection, wallet);
  const [galeria] = await calcularPdaGaleria(wallet.publicKey);
  const [wallpaper] = await calcularPdaWallpaper(galeria, id);

  const tx = await (programa.methods as any)
    .actualizarPrecio(nuevoPrecio)
    .accounts({
      wallpaper,
      owner: wallet.publicKey,
    })
    .rpc();

  return `Precio actualizado. Transacción: ${tx}`;
}

// Eliminar wallpaper
export async function eliminarWallpaper(
  connection: Connection,
  wallet: AnchorWallet,
  id: number
): Promise<string> {
  const programa = obtenerPrograma(connection, wallet);
  const [galeria] = await calcularPdaGaleria(wallet.publicKey);
  const [wallpaper] = await calcularPdaWallpaper(galeria, id);

  const tx = await (programa.methods as any)
    .eliminarWallpaper()
    .accounts({
      wallpaper,
      owner: wallet.publicKey,
    })
    .rpc();

  return `Wallpaper eliminado. Transacción: ${tx}`;
}

// Consultar una galería
export async function obtenerGaleria(
  connection: Connection,
  owner: PublicKey
): Promise<GaleriaData | null> {
  const [direccion] = await calcularPdaGaleria(owner);
  const info = await connection.getAccountInfo(direccion);

  if (!info || !info.owner.equals(PROGRAM_ID)) {
    return null;
  }

  const coder = new BorshAccountsCoder(IDL as Idl);
  const datos: any = coder.decode("Galeria", info.data);

  return {
    publicKey: direccion,
    owner: datos.owner,
    nombreGaleria: datos.nombreGaleria ?? datos.nombre_galeria,
    totalWallpapers: Number(
      (datos.totalWallpapers ?? datos.total_wallpapers).toString()
    ),
  };
}

// Consultar todas las galerías registradas
export async function obtenerGaleriasGlobales(
  connection: Connection
): Promise<GaleriaData[]> {
  const coder = new BorshAccountsCoder(IDL as Idl);

  const discriminador = bs58Encode(
    Buffer.from(GALERIA_DISCRIMINATOR)
  );

  const cuentas = await connection.getProgramAccounts(
    PROGRAM_ID,
    {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: discriminador,
          },
        },
      ],
    }
  );

  const galerias: GaleriaData[] = [];

  for (const cuenta of cuentas) {
    try {
      const datos: any = coder.decode(
        "Galeria",
        cuenta.account.data
      );

      // Verificar que la cuenta corresponda a la PDA
      // derivada de la wallet propietaria.
      const [pdaEsperada] = await calcularPdaGaleria(datos.owner);

      if (!pdaEsperada.equals(cuenta.pubkey)) {
        continue;
      }

      galerias.push({
        publicKey: cuenta.pubkey,
        owner: datos.owner,
        nombreGaleria:
          datos.nombreGaleria ?? datos.nombre_galeria,
        totalWallpapers: Number(
          (datos.totalWallpapers ?? datos.total_wallpapers).toString()
        ),
      });
    } catch {
      // Ignorar cuentas que no puedan validarse.
    }
  }

  return galerias;
}

// Consultar wallpapers de una galería
export async function obtenerWallpapers(
  connection: Connection,
  galeria: PublicKey
): Promise<WallpaperCatalogo[]> {
  const infoGaleria = await connection.getAccountInfo(galeria);

  if (!infoGaleria || !infoGaleria.owner.equals(PROGRAM_ID)) {
    return [];
  }

  const coder = new BorshAccountsCoder(IDL as Idl);
  const datosGaleria: any = coder.decode(
    "Galeria",
    infoGaleria.data
  );

  const total = Number(
    (datosGaleria.totalWallpapers ??
      datosGaleria.total_wallpapers).toString()
  );

  const resultados: WallpaperCatalogo[] = [];

  for (let inicio = 0; inicio < total; inicio += 20) {
    const ids = Array.from(
      { length: Math.min(20, total - inicio) },
      (_, i) => inicio + i
    );

    const direcciones = await Promise.all(
      ids.map(async (id) => {
        const [pda] = await calcularPdaWallpaper(galeria, id);
        return pda;
      })
    );

    const cuentas = await connection.getMultipleAccountsInfo(
      direcciones,
      "confirmed"
    );

    cuentas.forEach((cuenta, indice) => {
      if (!cuenta || !cuenta.owner.equals(PROGRAM_ID)) {
        return;
      }

      try {
        const datos: any = coder.decode(
          "Wallpaper",
          cuenta.data
        );

        const owner = datos.owner;
        const galeriaCuenta = datos.galeria;

        if (
          !galeriaCuenta?.equals(galeria) ||
          !owner?.equals(datosGaleria.owner)
        ) {
          return;
        }

        const id = Number(
          (datos.id ?? ids[indice]).toString()
        );

        resultados.push({
          publicKey: direcciones[indice],
          galeria,
          owner,
          id,
          titulo: datos.titulo,
          juego: datos.juego,
          urlImagen: datos.urlImagen ?? datos.url_imagen,
          precioLamports: new BN(
            (
              datos.precioLamports ??
              datos.precio_lamports
            ).toString()
          ),
          descargas: Number(datos.descargas.toString()),
        });
      } catch {
        // Omitir cuentas que no puedan decodificarse.
      }
    });
  }

  return resultados;
}

// Consultar el catálogo global de todos los creadores
export async function obtenerCatalogoGlobal(
  connection: Connection
): Promise<WallpaperCatalogo[]> {
  const galerias = await obtenerGaleriasGlobales(connection);

  const catalogo: WallpaperCatalogo[] = [];

  // Consultar cada galería y reunir sus publicaciones.
  for (const galeria of galerias) {
    const wallpapers = await obtenerWallpapers(
      connection,
      galeria.publicKey
    );

    catalogo.push(...wallpapers);
  }

  return catalogo;
}

// Obtener mensajes de error
export function obtenerMensajeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado.";
}