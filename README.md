# Forza Wallpapers Cashback 🏎️

Aplicación descentralizada (dApp) para publicar, adquirir y administrar wallpapers de **Forza Horizon 5 y Forza Motorsport**, con un sistema de recompensas mediante el token FWC, implementado con SPL Token-2022 en Solana Devnet.

## 1. Objetivo del proyecto

Incorporar un sistema de cashback a la plataforma Forza Wallpapers. Los usuarios pueden adquirir wallpapers mediante SOL y recibir recompensas en FWC, sujetas a la autorización de la wallet administradora.

## 2. Tecnologías utilizadas

- Solana Devnet
- Rust
- Anchor 0.31.1
- SPL Token-2022
- React 19
- TypeScript
- Vite
- Solana Web3.js
- Solana Wallet Adapter

## 3. Funcionalidades

- Visualización y administración de wallpapers.
- Conexión de wallets compatibles con Solana.
- Compra de wallpapers mediante SOL.
- Registro de operaciones de cashback.
- Consulta y administración del token FWC.
- Transferencia de recompensas desde una reserva central.

## 4. Token FWC

| Característica | Valor |
|---|---|
| Nombre | Forza Wallpapers Cashback |
| Símbolo | FWC |
| Red | Solana Devnet |
| Estándar | Token-2022 |
| Mint | BHmHxWzpg21tWeaAtu4i4ywUkLa32CDoVUrbrjCyEomH |
| Decimales | 2 |
| Suministro inicial | 1,000,000 FWC |
| Autoridad de administración | HKKExXwZ27B3AR5AGS6Kmw4GunJ9NjYD3KARWWKGZcEj |

### Extensiones implementadas

- MetadataPointer
- TokenMetadata

La autoridad de congelación está deshabilitada. El mint conserva su autoridad de emisión.

## 5. Programa en Solana

**Program ID:**

`CpvzJ6dcKsmfZMAnmhyx8vs3H8UjEbQnnzzPN1b7RDcC`

El programa está desarrollado en Rust con Anchor. Conserva las funcionalidades de administración existentes e incorpora la instrucción `registrar_cashback`.

Esta instrucción registra una operación de recompensa, valida los importes y transfiere FWC desde la reserva central hacia la cuenta del comprador mediante Token-2022.

## 6. Funcionamiento del cashback

La recompensa inicial está configurada en **10 FWC por compra**, independientemente del importe pagado en SOL.

El importe de recompensa se puede modificar desde la interfaz, sin necesidad de modificar el programa desplegado.

Flujo general:

1. El comprador realiza el pago en SOL directamente al creador del wallpaper.
2. La wallet administradora verifica la operación.
3. La administración autoriza el cashback.
4. Se registra la operación y se transfiere la recompensa desde la reserva central.

El pago en SOL y la entrega del cashback son transacciones separadas. La creación de la cuenta de tokens del comprador, el registro del cashback y la transferencia de FWC se agrupan en una misma transacción.

## 7. Reserva de recompensas

La reserva central mantiene los tokens destinados al cashback.

**Cuenta de reserva:**

`ASYFV24iksv9HG14JG3fe4NTLp7g6BtzQtjzAYjSgNo3`

La transferencia de recompensas requiere la autorización de la wallet administradora.

## 8. Instalación y ejecución

Clonar el repositorio:

```bash
git clone https://github.com/cris-ln/forza-wallpapers-cashback.git
cd forza-wallpapers-cashback
```

Instalar dependencias del frontend:

```bash
cd app
npm install
```

Ejecutar la aplicación:

```bash
npm run dev
```

## 9. Verificación

La compilación y la verificación de tipos del frontend se realizan con:

```bash
npx tsc --noEmit --pretty false
npm run build
```

Las operaciones de token y cashback se verifican en Solana Devnet.

## 10. Estructura del proyecto

- `programs/`: programa on-chain desarrollado en Rust.
- `app/`: aplicación web.
- `app/src/idl/`: interfaz de comunicación con el programa.
- `migrations/`: migraciones de Anchor.
- `tests/`: pruebas del proyecto.
- `Anchor.toml`: configuración de Anchor.
- `Cargo.toml`: configuración del proyecto Rust.

## 11. Consideraciones y limitaciones

- El proyecto utiliza Solana Devnet y no representa operaciones con fondos reales.
- El pago en SOL y el cashback no forman una única transacción.
- La recompensa inicial es fija en 10 FWC por compra.
- La configuración de la recompensa se administra desde el frontend.
- El mint no incluye la extensión PermanentDelegate.
- No se implementa un mecanismo de reembolso mediante PermanentDelegate.

## 12. Repositorio

[Forza Wallpapers Cashback - GitHub](https://github.com/cris-ln/forza-wallpapers-cashback)