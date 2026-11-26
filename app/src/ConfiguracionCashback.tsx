import { useCallback, useEffect, useState } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "bn.js";
import { PROGRAM_ID, obtenerPrograma } from "./acciones";

const ADMIN = new PublicKey("HKKExXwZ27B3AR5AGS6Kmw4GunJ9NjYD3KARWWKGZcEj");

const [CONFIG] = PublicKey.findProgramAddressSync(
  [Buffer.from("cashback_config")],
  PROGRAM_ID
);

export default function ConfiguracionCashback() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [recompensa, setRecompensa] = useState("10");
  const [configurada, setConfigurada] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState("Consultando configuración...");

  const esAdmin = wallet.publicKey?.equals(ADMIN) ?? false;

  const consultar = useCallback(async () => {
    try {
      const info = await connection.getAccountInfo(CONFIG, "confirmed");

      if (!info) {
        setConfigurada(false);
        setEstado("La configuración todavía no ha sido inicializada.");
        return;
      }

      setConfigurada(true);

      if (anchorWallet) {
        const programa = obtenerPrograma(connection, anchorWallet);
        const datos = await (programa.account as any).cashbackConfig.fetch(CONFIG);
        setRecompensa(
          (Number(datos.rewardAmount.toString()) / 100).toFixed(2)
        );
        setEstado("Configuración consultada directamente en Solana Devnet.");
      } else {
        setEstado("Configuración inicializada. Conecta la wallet administradora para consultar el importe.");
      }
    } catch (error) {
      setEstado(error instanceof Error ? error.message : "Error consultando configuración.");
    }
  }, [connection, anchorWallet]);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  async function guardarConfiguracion() {
    try {
      if (!esAdmin || !anchorWallet) {
        throw new Error("Conecta la wallet administradora para modificar la recompensa.");
      }

      if (!/^\d+(\.\d{1,2})?$/.test(recompensa)) {
        throw new Error("Introduce un importe válido con máximo dos decimales.");
      }

      const unidades = Math.round(Number(recompensa) * 100);

      if (!Number.isSafeInteger(unidades) || unidades <= 0) {
        throw new Error("La recompensa debe ser mayor que cero.");
      }

      setCargando(true);
      setEstado("Enviando transacción a Solana Devnet...");

      const programa = obtenerPrograma(connection, anchorWallet);

      if (configurada) {
        await (programa.methods as any)
          .actualizarCashbackConfig(new BN(unidades))
          .accounts({
            config: CONFIG,
            admin: wallet.publicKey,
          })
          .rpc();
      } else {
        await (programa.methods as any)
          .inicializarCashbackConfig(new BN(unidades))
          .accounts({
            config: CONFIG,
            admin: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }

      setEstado("¡Configuración guardada correctamente en Solana Devnet!");
      await consultar();
    } catch (error) {
      setEstado(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <section style={{
      marginTop: "18px",
      padding: "16px",
      border: "1px solid var(--border-color, #555)",
      borderRadius: "12px",
      display: "grid",
      gap: "12px"
    }}>
      <h3>Administración de cashback FWC</h3>

      <p>
        Estado: <strong>{estado}</strong>
      </p>

      <p>
        Cuenta de configuración: <br />
        <code style={{ overflowWrap: "anywhere" }}>{CONFIG.toBase58()}</code>
      </p>

      <label htmlFor="recompensa-fwc">
        Recompensa por compra (FWC)
      </label>

      <input
        id="recompensa-fwc"
        type="number"
        min="0.01"
        step="0.01"
        value={recompensa}
        onChange={(event) => setRecompensa(event.target.value)}
        disabled={!esAdmin || cargando}
      />

      {esAdmin ? (
        <button
          type="button"
          onClick={() => void guardarConfiguracion()}
          disabled={cargando}
        >
          {cargando
            ? "Procesando..."
            : configurada
              ? "Actualizar recompensa"
              : "Inicializar recompensa"}
        </button>
      ) : (
        <p>Conecta la wallet administradora para gestionar esta configuración.</p>
      )}

      <button type="button" onClick={() => void consultar()} disabled={cargando}>
        Consultar configuración
      </button>
    </section>
  );
}
