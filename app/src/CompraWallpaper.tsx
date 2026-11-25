import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";

import { comprarWallpaper } from "./compras";
import { aprobarCashback } from "./aprobacion";
import { FWC_ADMIN } from "./cashback";

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

  const [firmaPago, setFirmaPago] = useState("");
  const [comprador, setComprador] = useState("");
  const [firmaCashback, setFirmaCashback] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const esAdministradora =
    wallet.publicKey?.equals(FWC_ADMIN) ?? false;

  const precioSOL =
    Number(wallpaper.precioLamports.toString()) / 1_000_000_000;

  async function realizarCompra() {
    try {
      setCargando(true);
      setMensaje("");

      if (!wallet.connected || !wallet.publicKey) {
        throw new Error("Conecta tu wallet para realizar la compra.");
      }

      const firma = await comprarWallpaper(
        connection,
        wallet,
        wallpaper.owner,
        wallpaper.precioLamports
      );

      setFirmaPago(firma);
      setComprador(wallet.publicKey.toBase58());

      setMensaje(
        "¡Pago confirmado! Comparte la firma con la administradora para solicitar tu cashback."
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

  async function autorizarCashback() {
    try {
      setCargando(true);
      setMensaje("");
      setFirmaCashback("");

      if (!wallet.publicKey?.equals(FWC_ADMIN)) {
        throw new Error("Conecta la wallet administradora.");
      }

      if (!anchorWallet) {
        throw new Error(
          "No se pudo obtener la wallet compatible con Anchor. Reconecta la wallet administradora."
        );
      }

      if (!firmaPago.trim() || !comprador.trim()) {
        throw new Error(
          "Introduce la firma del pago y la wallet del comprador."
        );
      }

      const compradorPublicKey = new PublicKey(comprador.trim());

      const resultado = await aprobarCashback(
        connection,
        anchorWallet,
        firmaPago.trim(),
        compradorPublicKey,
        wallpaper.owner,
        wallpaper.precioLamports
      );

      setFirmaCashback(resultado.firmaCashback);

      setMensaje(
        `Cashback confirmado: ${resultado.cantidadFWC} FWC entregados al comprador.`
      );
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo autorizar el cashback."
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
          El pago se envía directamente al creador.
        </p>
      </div>

      <button
        type="button"
        style={{
          ...estiloBoton,
          background: "#2563eb",
          color: "white",
        }}
        disabled={cargando || !wallet.connected}
        onClick={realizarCompra}
      >
        {cargando ? "Procesando..." : "Comprar wallpaper"}
      </button>

      {firmaPago && (
        <div style={{ overflowWrap: "anywhere" }}>
          <strong>Firma del pago</strong>
          <p>{firmaPago}</p>
          <button
            type="button"
            style={estiloBoton}
            onClick={() => navigator.clipboard.writeText(firmaPago)}
          >
            Copiar firma
          </button>
        </div>
      )}

      {esAdministradora && (
        <div
          style={{
            display: "grid",
            gap: "10px",
            borderTop: "1px solid var(--border-color, #555)",
            paddingTop: "14px",
          }}
        >
          <strong>Administración del cashback</strong>

          <label>
            Firma de la compra
            <input
              value={firmaPago}
              onChange={(event) => setFirmaPago(event.target.value)}
              placeholder="Firma de la transacción SOL"
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "5px",
              }}
            />
          </label>

          <label>
            Wallet del comprador
            <input
              value={comprador}
              onChange={(event) => setComprador(event.target.value)}
              placeholder="Dirección pública del comprador"
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "5px",
              }}
            />
          </label>

          <button
            type="button"
            style={{
              ...estiloBoton,
              background: "#15803d",
              color: "white",
            }}
            disabled={cargando || !anchorWallet}
            onClick={autorizarCashback}
          >
            {cargando
              ? "Verificando y procesando..."
              : "Verificar compra y entregar cashback"}
          </button>

          {firmaCashback && (
            <div style={{ overflowWrap: "anywhere" }}>
              <strong>Firma del cashback</strong>
              <p>{firmaCashback}</p>
              <button
                type="button"
                style={estiloBoton}
                onClick={() =>
                  navigator.clipboard.writeText(firmaCashback)
                }
              >
                Copiar firma del cashback
              </button>
            </div>
          )}
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
