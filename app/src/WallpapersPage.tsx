import "./App.css";
import CompraWallpaper from "./CompraWallpaper";
import CashbackMetadataPanel from "./CashbackMetadataPanel";
import { crearTransaccionNuevoFWC } from "./solana/token2022";

import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { FormEvent } from "react";
import { VersionedTransaction } from "@solana/web3.js";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import {
  crearGaleria,
  publicarWallpaper,
  actualizarPrecio,
  eliminarWallpaper,
  obtenerGaleria,
  obtenerWallpapers,
  obtenerCatalogoGlobal,
  lamportsASol,
  solALamports,
  obtenerMensajeError,
} from "./acciones";

import type { WallpaperCatalogo } from "./acciones";

// =====================================================
// INSTAGRAM
// =====================================================

let instagramScriptPromise: Promise<void> | null = null;

function cargarScriptInstagram(): Promise<void> {
  if ((window as any).instgrm?.Embeds) {
    return Promise.resolve();
  }

  if (instagramScriptPromise) {
    return instagramScriptPromise;
  }

  const scriptUrl = "https://www.instagram.com/embed.js";

  instagramScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptUrl}"]`
    );

    if (!script) {
      script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      document.body.appendChild(script);
    }

    script.addEventListener(
      "load",
      () => resolve(),
      { once: true }
    );

    script.addEventListener(
      "error",
      () => {
        instagramScriptPromise = null;
        reject(
          new Error("No se pudo cargar el contenido de Instagram.")
        );
      },
      { once: true }
    );

    // Si el script ya estaba cargado, comprobar nuevamente
    // si Instagram terminó de inicializar su API.
    if ((window as any).instgrm?.Embeds) {
      resolve();
    }
  });

  return instagramScriptPromise;
}

function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    let activo = true;

    cargarScriptInstagram()
      .then(() => {
        if (activo) {
          (window as any).instgrm?.Embeds?.process();
        }
      })
      .catch((error) => {
        console.error("Error al cargar Instagram:", error);
      });

    return () => {
      activo = false;
    };
  }, [url]);

  return (
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
      style={{
        background: "#fff",
        border: 0,
        borderRadius: 8,
        margin: "10px auto",
        maxWidth: 540,
        minWidth: 280,
        width: "100%",
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        Ver publicación en Instagram
      </a>
    </blockquote>
  );
}

// =====================================================
// UTILIDADES
// =====================================================

function abreviarWallet(wallet: { toString(): string }): string {
  const direccion = wallet.toString();

  return `${direccion.slice(0, 4)}...${direccion.slice(-4)}`;
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

export default function WallpapersPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [creandoFWC, setCreandoFWC] = useState(false);
  const [estadoCreacionFWC, setEstadoCreacionFWC] = useState("");

  async function crearFWC() {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setEstadoCreacionFWC("Conecta primero Phantom.");
      return;
    }

    try {
      setCreandoFWC(true);
      setEstadoCreacionFWC("Preparando el nuevo mint...");

      const resultado = await crearTransaccionNuevoFWC(
        connection,
        wallet.publicKey
      );

      const latest = await connection.getLatestBlockhash("confirmed");
      resultado.transaction.feePayer = wallet.publicKey;
      resultado.transaction.recentBlockhash = latest.blockhash;

      // Firmar únicamente con la clave temporal del mint para simular.
      resultado.transaction.partialSign(resultado.mint);

      setEstadoCreacionFWC("Comprobando la transacción antes de abrir Phantom...");

      const transaccionSimulacion = new VersionedTransaction(
        resultado.transaction.compileMessage()
      );
      transaccionSimulacion.sign([resultado.mint]);

      const simulacion = await connection.simulateTransaction(
        transaccionSimulacion,
        {
          sigVerify: false,
          replaceRecentBlockhash: false,
          commitment: "confirmed",
        }
      );

      if (simulacion.value.err) {
        const detalle = (simulacion.value.logs || []).join("\\n");
        console.error("SIMULACIÓN FWC FALLIDA:", simulacion.value.err, detalle);
        setEstadoCreacionFWC(
          "SIMULACIÓN FALLIDA: " +
          JSON.stringify(simulacion.value.err) +
          "\\n" + detalle
        );
        return;
      }

      setEstadoCreacionFWC("Simulación correcta. Confirma la creación del token en Phantom.");

      const firma = await wallet.sendTransaction(
        resultado.transaction,
        connection,
        { signers: [resultado.mint] }
      );

      await connection.confirmTransaction(
        {
          signature: firma,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      setEstadoCreacionFWC(
        `FWC creado: ${resultado.mint.publicKey.toBase58()}`
      );
    } catch (error) {
      console.error("ERROR COMPLETO AL CREAR FWC:", error);

      let detalle = "";
      try {
        const e = error as any;
        detalle = JSON.stringify(
          e,
          e && typeof e === "object"
            ? Object.getOwnPropertyNames(e)
            : undefined,
          2
        );
      } catch {
        detalle = String(error);
      }

      const mensaje = error instanceof Error
        ? error.message
        : String((error as any)?.message || error);

      setEstadoCreacionFWC(
        "ERROR AL CREAR FWC: " + mensaje +
        (detalle && detalle !== "{}" ? "\\nDetalles: " + detalle : "")
      );
    } finally {
      setCreandoFWC(false);
    }
  }


  // Datos de galerías y publicaciones.
  const [galeria, setGaleria] = useState<any>(null);

  const [wallpapers, setWallpapers] = useState<
    WallpaperCatalogo[]
  >([]);

  const [catalogoGlobal, setCatalogoGlobal] = useState<
    WallpaperCatalogo[]
  >([]);

  // Formularios.
  const [nombreGaleria, setNombreGaleria] = useState("");
  const [titulo, setTitulo] = useState("");
  const [juego, setJuego] = useState("Forza Horizon 5");
  const [urlImagen, setUrlImagen] = useState("");
  const [precio, setPrecio] = useState("0.01");
  const [nuevoPrecio, setNuevoPrecio] = useState("");

  // Estados de la interfaz.
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);

  // ===================================================
  // CATÁLOGO GLOBAL
  // ===================================================

  const cargarCatalogo = useCallback(async () => {
    setCargandoCatalogo(true);

    try {
      const lista = await obtenerCatalogoGlobal(connection);

      setCatalogoGlobal(lista);
    } catch (error) {
      setMensaje(obtenerMensajeError(error));
    } finally {
      setCargandoCatalogo(false);
    }
  }, [connection]);

  // ===================================================
  // GALERÍA PERSONAL
  // ===================================================

  const cargarDatos = useCallback(async () => {
    if (!wallet.publicKey) {
      setGaleria(null);
      setWallpapers([]);
      return;
    }

    try {
      const datosGaleria = await obtenerGaleria(
        connection,
        wallet.publicKey
      );

      setGaleria(datosGaleria);

      if (datosGaleria) {
        const lista = await obtenerWallpapers(
          connection,
          datosGaleria.publicKey
        );

        setWallpapers(lista);
      } else {
        setWallpapers([]);
      }
    } catch (error) {
      setMensaje(obtenerMensajeError(error));
    }
  }, [connection, wallet.publicKey]);

  // Cargar el catálogo independientemente de la wallet.
  useEffect(() => {
    void cargarCatalogo();
  }, [cargarCatalogo]);

  // Cargar la galería personal cuando cambia la wallet.
  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  // ===================================================
  // EJECUTAR OPERACIONES
  // ===================================================

  async function ejecutar(accion: () => Promise<string>) {
    setCargando(true);
    setMensaje("");

    try {
      const resultado = await accion();

      setMensaje(resultado);

      await Promise.all([
        cargarDatos(),
        cargarCatalogo(),
      ]);
    } catch (error) {
      setMensaje(obtenerMensajeError(error));
    } finally {
      setCargando(false);
    }
  }

  // ===================================================
  // CREAR GALERÍA
  // ===================================================

  async function manejarCrearGaleria(e: FormEvent) {
    e.preventDefault();

    if (!wallet.publicKey || !anchorWallet) {
      setMensaje("Conecta tu wallet para continuar.");
      return;
    }

    await ejecutar(() =>
      crearGaleria(
        connection,
        anchorWallet,
        nombreGaleria
      )
    );

    setNombreGaleria("");
  }

  // ===================================================
  // PUBLICAR WALLPAPER
  // ===================================================

  async function manejarPublicar(e: FormEvent) {
    e.preventDefault();

    if (!wallet.publicKey || !anchorWallet) {
      setMensaje("Conecta tu wallet para continuar.");
      return;
    }

    await ejecutar(() =>
      publicarWallpaper(
        connection,
        anchorWallet,
        titulo,
        juego,
        urlImagen,
        solALamports(precio)
      )
    );

    setTitulo("");
    setUrlImagen("");
    setPrecio("0.01");
  }

  // ===================================================
  // ACTUALIZAR PRECIO
  // ===================================================

  async function manejarActualizar(id: number) {
    if (!wallet.publicKey || !anchorWallet || !nuevoPrecio) {
      return;
    }

    await ejecutar(() =>
      actualizarPrecio(
        connection,
        anchorWallet,
        id,
        solALamports(nuevoPrecio)
      )
    );

    setNuevoPrecio("");
  }

  // ===================================================
  // ELIMINAR WALLPAPER
  // ===================================================

  async function manejarEliminar(id: number) {
    if (!wallet.publicKey || !anchorWallet) {
      return;
    }

    if (!window.confirm("¿Deseas eliminar este wallpaper?")) {
      return;
    }

    await ejecutar(() =>
      eliminarWallpaper(
        connection,
        anchorWallet,
        id
      )
    );
  }

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <main className="pagina">

      {/* ENCABEZADO */}

      <header className="encabezado">
        <div>
          <h1>Forza Wallpapers</h1>
          <p>Tu colección de wallpapers en Solana</p>
        </div>

        <WalletMultiButton />
        <button onClick={crearFWC} disabled={creandoFWC || !wallet.connected}>
          {creandoFWC ? "CREANDO FWC..." : "CREAR TOKEN FWC"}
        </button>
        {estadoCreacionFWC && <p>{estadoCreacionFWC}</p>}
      </header>

      {/* PORTADA */}

      <section className="hero">
        <div className="hero-contenido">
          <span className="hero-etiqueta">
            THE ULTIMATE RACING COLLECTION
          </span>

          <h2>
            YOUR RIDE.
            <br />
            YOUR STYLE.
          </h2>

          <p>
            Descubre, colecciona y comparte wallpapers
            de tus automóviles favoritos.
          </p>

          <a href="#catalogo" className="hero-boton">
            EXPLORAR COLECCIÓN →
          </a>
        </div>

        <div className="hero-numero">
          FH5 / FM
        </div>
      </section>

      {/* INFORMACIÓN TOKEN CASHBACK */}

      <CashbackMetadataPanel />

      {/* MENSAJES */}

      {mensaje && (
        <div className="mensaje" role="status">
          {mensaje}
        </div>
      )}

      {/* =================================================
          CATÁLOGO GLOBAL
      ================================================= */}

      <section className="catalogo" id="catalogo">

        <div className="catalogo-encabezado">
          <div>
            <span className="hero-etiqueta">
              DISCOVER THE COLLECTION
            </span>

            <h2>Explorar wallpapers</h2>

            <p className="texto-secundario">
              Descubre las publicaciones de todos los creadores.
            </p>
          </div>

          <button
            type="button"
            className="boton-secundario"
            onClick={() => void cargarCatalogo()}
            disabled={cargandoCatalogo}
          >
            {cargandoCatalogo
              ? "Actualizando..."
              : "Actualizar catálogo"}
          </button>
        </div>

        {cargandoCatalogo ? (
          <div className="estado-catalogo">
            Consultando publicaciones en Solana Devnet...
          </div>
        ) : catalogoGlobal.length === 0 ? (
          <div className="estado-catalogo">
            <h3>Aún no hay wallpapers publicados.</h3>

            <p>
              Cuando los creadores publiquen sus imágenes,
              aparecerán aquí.
            </p>
          </div>
        ) : (
          <>
            <p className="contador-catalogo">
              {catalogoGlobal.length} wallpaper(s) publicados
            </p>

            <div className="rejilla">
              {catalogoGlobal.map((item) => (
                <article
                  className="tarjeta"
                  key={item.publicKey.toBase58()}
                >

                  <InstagramEmbed url={item.urlImagen} />

                  <div className="contenido-tarjeta">
                    <span className="etiqueta-juego">
                      {item.juego}
                    </span>

                    <h3>{item.titulo}</h3>

                    <p className="precio-wallpaper">
                      {lamportsASol(item.precioLamports)} SOL
                    </p>

                    <p>
                      Creador: {abreviarWallet(item.owner)}
                    </p>

                    <p>
                      Descargas: {item.descargas}
                    </p>

                    <CompraWallpaper wallpaper={item} />
                  </div>

                </article>
              ))}
            </div>
          </>
        )}

      </section>

      {/* =================================================
          ADMINISTRACIÓN PERSONAL
      ================================================= */}

      {!wallet.connected ? (

        <section className="panel">
          <h2>¿Eres creador?</h2>

          <p>
            Conecta Phantom o Solflare para crear y administrar
            tu propia galería de wallpapers.
          </p>
        </section>

      ) : (

        <>
          {/* CREAR GALERÍA */}

          {!galeria && (
            <section className="panel">
              <h2>Crear galería</h2>

              <form onSubmit={manejarCrearGaleria}>
                <input
                  value={nombreGaleria}
                  onChange={(e) =>
                    setNombreGaleria(e.target.value)
                  }
                  placeholder="Nombre de tu galería"
                  maxLength={30}
                  required
                />

                <button disabled={cargando}>
                  Crear galería
                </button>
              </form>
            </section>
          )}

          {/* GALERÍA EXISTENTE */}

          {galeria && (
            <>
              <section className="panel">
                <h2>
                  Mi galería: {galeria.nombreGaleria}
                </h2>

                <p>
                  Wallpapers publicados: {wallpapers.length}
                </p>
              </section>

              {/* PUBLICAR */}

              <section className="panel">
                <h2>Publicar wallpaper</h2>

                <form onSubmit={manejarPublicar}>
                  <input
                    value={titulo}
                    onChange={(e) =>
                      setTitulo(e.target.value)
                    }
                    placeholder="Título"
                    maxLength={30}
                    required
                  />

                  <select
                    value={juego}
                    onChange={(e) =>
                      setJuego(e.target.value)
                    }
                  >
                    <option>Forza Horizon 5</option>
                    <option>Forza Motorsport</option>
                  </select>

                  <input
                    type="url"
                    value={urlImagen}
                    onChange={(e) =>
                      setUrlImagen(e.target.value)
                    }
                    placeholder="URL de la publicación de Instagram"
                    required
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.000000001"
                    value={precio}
                    onChange={(e) =>
                      setPrecio(e.target.value)
                    }
                    placeholder="Precio en SOL"
                    required
                  />

                  <button disabled={cargando}>
                    Publicar wallpaper
                  </button>
                </form>
              </section>

              {/* COLECCIÓN PERSONAL */}

              <section className="catalogo">
                <h2>Mi colección</h2>

                {wallpapers.length === 0 ? (
                  <p>
                    Aún no tienes wallpapers publicados.
                  </p>
                ) : (
                  <div className="rejilla">
                    {wallpapers.map((item) => (
                      <article
                        className="tarjeta"
                        key={item.publicKey.toBase58()}
                      >

                        <InstagramEmbed url={item.urlImagen} />

                        <div className="contenido-tarjeta">
                          <h3>{item.titulo}</h3>

                          <p>{item.juego}</p>

                          <p>
                            Precio:{" "}
                            {lamportsASol(item.precioLamports)} SOL
                          </p>

                          <p>
                            Descargas: {item.descargas}
                          </p>

                          <input
                            type="number"
                            min="0"
                            step="0.000000001"
                            value={nuevoPrecio}
                            onChange={(e) =>
                              setNuevoPrecio(e.target.value)
                            }
                            placeholder="Nuevo precio en SOL"
                          />

                          <button
                            disabled={cargando || !nuevoPrecio}
                            onClick={() =>
                              manejarActualizar(item.id)
                            }
                          >
                            Actualizar precio
                          </button>

                          <button
                            className="boton-eliminar"
                            disabled={cargando}
                            onClick={() =>
                              manejarEliminar(item.id)
                            }
                          >
                            Eliminar
                          </button>
                        </div>

                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {cargando && (
        <p className="estado-catalogo">
          Procesando transacción...
        </p>
      )}

    </main>
  );
}