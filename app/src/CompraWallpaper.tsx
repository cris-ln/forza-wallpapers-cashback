import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";

import { comprarWallpaper } from "./compras";

interface Props {
  wallpaper: {
    publicKey: PublicKey;
    owner: PublicKey;
    titulo: string;
    precioLamports: BN;
  };
}

export default function CompraWallpaper({ wallpaper }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [firmaCompra, setFirmaCompra] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const precioSOL =
    Number(wallpaper.precioLamports.toString()) / 1_000_000_000;

  async function realizarCompra() {
    try {
      setCargando(true);
      setMensaje("");
      setFirmaCompra("");

      if (!wallet.connected || !wallet.publicKey) {
        throw new Error("Conecta tu wallet para realizar la compra.");
      }

      if (!anchorWallet) {
        throw new Error(
          "Tu wallet no permite firmar transacciones compatibles con Anchor. Reconéctala."
        );
      }

      const firma = await comprarWallpaper(
        connection,
        anchorWallet,
        wallpaper.publicKey,
        wallpaper.owner
      );

      setFirmaCompra(firma);

      setMensaje(
        "¡Compra confirmada! El pago SOL llegó al creador y el cashback FWC fue entregado en la misma transacción."
      );
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo completar la compra."
      );
    } finally {
      setCargando(false);
    }
  }

  const estiloBoton = {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    cursor: cargando ? "wait" : "pointer",
    fontWeight: 600 as const,
    opacity: cargando ? 0.6 : 1,
  };

  return (
    <section
      style={{
        marginTop: "14px",
        padding: "14px",
        border: "1px solid var(--border-color, #555)",
        borderRadius: "12px",
        display: "grid",
        gap: "12px",
      }}
    >
      <div>
        <strong>Adquirir wallpaper</strong>
        <p style={{ margin: "6px 0" }}>
          Precio: {precioSOL.toFixed(6)} SOL
        </p>
        <p style={{ margin: "6px 0", fontSize: "0.9em" }}>
          Pago directo al creador y cashback FWC automático en una sola transacción.
        </p>
      </div>

      <button
        type="button"
        style={{
          ...estiloBoton,
          background: "#2563eb",
          color: "white",
        }}
        disabled={cargando || !wallet.connected || !anchorWallet}
        onClick={realizarCompra}
      >
        {cargando ? "Procesando compra..." : "Comprar wallpaper"}
      </button>

      {firmaCompra && (
        <div style={{ overflowWrap: "anywhere" }}>
          <strong>Firma de la compra</strong>
          <p>{firmaCompra}</p>
          <button
            type="button"
            style={estiloBoton}
            onClick={() => navigator.clipboard.writeText(firmaCompra)}
          >
            Copiar firma
          </button>
        </div>
      )}

      {mensaje && (
        <p
          role="status"
          style={{
            margin: 0,
            overflowWrap: "anywhere",
            fontSize: "0.92em",
          }}
        >
          {mensaje}
        </p>
      )}
    </section>
  );
}
