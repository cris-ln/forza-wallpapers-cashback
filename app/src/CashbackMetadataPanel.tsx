import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

const MINT = new PublicKey(
  "BHmHxWzpg21tWeaAtu4i4ywUkLa32CDoVUrbrjCyEomH"
);

const ADMIN = new PublicKey(
  "HKKExXwZ27B3AR5AGS6Kmw4GunJ9NjYD3KARWWKGZcEj"
);

const RESERVE = new PublicKey(
  "ASYFV24iksv9HG14JG3fe4NTLp7g6BtzQtjzAYjSgNo3"
);

const DECIMALS = 2;

function formatearFWC(amount: bigint) {
  return `${(Number(amount) / 10 ** DECIMALS).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} FWC`;
}

export default function CashbackMetadataPanel() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [supply, setSupply] = useState("Consultando...");
  const [saldoReserva, setSaldoReserva] = useState("Consultando...");
  const [saldoPersonal, setSaldoPersonal] = useState("Consultando...");
  const [cuentaPersonal, setCuentaPersonal] = useState("");
  const [estado, setEstado] = useState("Consultando Solana Devnet...");
  const [cargando, setCargando] = useState(false);

  const consultarDatos = useCallback(async () => {
    setCargando(true);
    setEstado("Consultando información en Solana Devnet...");

    try {
      const [mintInfo, reserveInfo] = await Promise.all([
        getMint(
          connection,
          MINT,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        ),
        getAccount(
          connection,
          RESERVE,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        ),
      ]);

      if (mintInfo.decimals !== DECIMALS) {
        throw new Error("Los decimales del Mint FWC no coinciden.");
      }

      if (!reserveInfo.mint.equals(MINT)) {
        throw new Error("La reserva no corresponde al Mint FWC.");
      }

      if (!reserveInfo.owner.equals(ADMIN)) {
        throw new Error("La autoridad de la reserva no es la administradora.");
      }

      setSupply(formatearFWC(mintInfo.supply));
      setSaldoReserva(formatearFWC(reserveInfo.amount));

      if (wallet.publicKey) {
        const ata = getAssociatedTokenAddressSync(
          MINT,
          wallet.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );

        setCuentaPersonal(ata.toBase58());

        const ataInfo = await connection.getAccountInfo(
          ata,
          "confirmed"
        );

        if (ataInfo) {
          const personalInfo = await getAccount(
            connection,
            ata,
            "confirmed",
            TOKEN_2022_PROGRAM_ID
          );

          if (
            !personalInfo.mint.equals(MINT) ||
            !personalInfo.owner.equals(wallet.publicKey)
          ) {
            throw new Error(
              "La cuenta personal no corresponde a la wallet conectada."
            );
          }

          setSaldoPersonal(formatearFWC(personalInfo.amount));
        } else {
          setSaldoPersonal(formatearFWC(BigInt(0)));
        }
      } else {
        setCuentaPersonal("");
        setSaldoPersonal("Conecta tu wallet");
      }

      setEstado("Conectado a Solana Devnet. Datos actualizados correctamente.");
    } catch (error) {
      console.error("Error consultando FWC:", error);

      setEstado(
        error instanceof Error
          ? `Error: ${error.message}`
          : "No se pudo consultar la información de FWC."
      );

      setSupply("No disponible");
      setSaldoReserva("No disponible");
      setSaldoPersonal("No disponible");
    } finally {
      setCargando(false);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    void consultarDatos();
  }, [consultarDatos]);

  return (
    <section className="cashback-metadata-panel">
      <h2>Token Cashback (FWC)</h2>

      <p>
        Consulta de saldos y administración del token de recompensas
        de Forza Wallpapers mediante Token-2022.
      </p>

      <p>
        <strong>Mint:</strong> {MINT.toBase58()}
      </p>

      <p>
        <strong>Red:</strong> Solana Devnet
      </p>

      <p>
        <strong>Estado:</strong> {estado}
      </p>

      <hr />

      <h3>Información del token</h3>

      <p>
        <strong>Supply total:</strong> {supply}
      </p>

      <p>
        <strong>Decimales:</strong> {DECIMALS}
      </p>

      <p>
        <strong>Programa:</strong> Token-2022
      </p>

      <hr />

      <h3>Reserva central del proyecto</h3>

      <p>
        <strong>Dirección:</strong> {RESERVE.toBase58()}
      </p>

      <p>
        <strong>Autoridad:</strong> {ADMIN.toBase58()}
      </p>

      <p>
        <strong>Saldo disponible:</strong> {saldoReserva}
      </p>

      <hr />

      <h3>Mi saldo FWC</h3>

      {wallet.publicKey ? (
        <>
          <p>
            <strong>Wallet conectada:</strong>{" "}
            {wallet.publicKey.toBase58()}
          </p>

          <p>
            <strong>Cuenta personal FWC:</strong> {cuentaPersonal}
          </p>

          <p>
            <strong>Mi saldo:</strong> {saldoPersonal}
          </p>
        </>
      ) : (
        <p>Conecta Phantom o Solflare para consultar tu saldo personal.</p>
      )}

      <button
        type="button"
        onClick={() => void consultarDatos()}
        disabled={cargando}
      >
        {cargando ? "Consultando..." : "Actualizar información FWC"}
      </button>
    </section>
  );
}