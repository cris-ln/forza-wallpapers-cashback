// Forza Wallpapers - Galerias, wallpapers y cashback
use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("CpvzJ6dcKsmfZMAnmhyx8vs3H8UjEbQnnzzPN1b7RDcC");

pub const MAX_NOMBRE_GALERIA: usize = 30;
pub const MAX_TITULO: usize = 30;
pub const MAX_JUEGO: usize = 20;
pub const MAX_URL_IMAGEN: usize = 80;

pub const SEED_GALERIA: &[u8] = b"galeria";
pub const SEED_WALLPAPER: &[u8] = b"wallpaper";
pub const SEED_CASHBACK: &[u8] = b"cashback";
pub const SEED_CASHBACK_CONFIG: &[u8] = b"cashback_config";
pub const SEED_FWC_DELEGATE: &[u8] = b"fwc_delegate";

pub const FWC_ADMIN: Pubkey =
    pubkey!("HKKExXwZ27B3AR5AGS6Kmw4GunJ9NjYD3KARWWKGZcEj");
pub const FWC_MINT: Pubkey =
    pubkey!("CkQ7RzCSCXEB9hWefua162ps8Q1b8ZUpB77aTPXDzNJf");
pub const TOKEN_2022_PROGRAM_ID: Pubkey =
    pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
pub const FWC_DECIMALES: u8 = 2;

#[program]
pub mod forza_wallpapers {
    use super::*;

    pub fn crear_galeria(
        ctx: Context<CrearGaleria>,
        nombre_galeria: String,
    ) -> Result<()> {
        require!(!nombre_galeria.trim().is_empty(), ErroresGaleria::CampoVacio);
        require!(
            nombre_galeria.len() <= MAX_NOMBRE_GALERIA,
            ErroresGaleria::NombreGaleriaMuyLargo
        );

        let galeria = &mut ctx.accounts.galeria;
        galeria.owner = ctx.accounts.owner.key();
        galeria.nombre_galeria = nombre_galeria;
        galeria.total_wallpapers = 0;
        galeria.bump = ctx.bumps.galeria;
        Ok(())
    }

    pub fn publicar_wallpaper(
        ctx: Context<PublicarWallpaper>,
        titulo: String,
        juego: String,
        url_imagen: String,
        precio_lamports: u64,
    ) -> Result<()> {
        require!(!titulo.trim().is_empty(), ErroresGaleria::CampoVacio);
        require!(!juego.trim().is_empty(), ErroresGaleria::CampoVacio);
        require!(!url_imagen.trim().is_empty(), ErroresGaleria::CampoVacio);
        require!(titulo.len() <= MAX_TITULO, ErroresGaleria::TituloMuyLargo);
        require!(juego.len() <= MAX_JUEGO, ErroresGaleria::JuegoMuyLargo);
        require!(url_imagen.len() <= MAX_URL_IMAGEN, ErroresGaleria::UrlMuyLarga);

        let galeria = &mut ctx.accounts.galeria;
        let wallpaper = &mut ctx.accounts.wallpaper;

        wallpaper.owner = ctx.accounts.owner.key();
        wallpaper.galeria = galeria.key();
        wallpaper.id = galeria.total_wallpapers;
        wallpaper.titulo = titulo;
        wallpaper.juego = juego;
        wallpaper.url_imagen = url_imagen;
        wallpaper.precio_lamports = precio_lamports;
        wallpaper.descargas = 0;
        wallpaper.bump = ctx.bumps.wallpaper;

        galeria.total_wallpapers = galeria.total_wallpapers
            .checked_add(1)
            .ok_or(ErroresGaleria::ContadorDesbordado)?;
        Ok(())
    }

    pub fn actualizar_precio(
        ctx: Context<ActualizarPrecio>,
        nuevo_precio: u64,
    ) -> Result<()> {
        ctx.accounts.wallpaper.precio_lamports = nuevo_precio;
        Ok(())
    }

    pub fn eliminar_wallpaper(
        _ctx: Context<EliminarWallpaper>,
    ) -> Result<()> {
        Ok(())
    }

    pub fn inicializar_cashback_config(
        ctx: Context<InicializarCashbackConfig>,
        reward_amount: u64,
    ) -> Result<()> {
        require!(reward_amount > 0, ErroresGaleria::MontoInvalido);

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.reward_amount = reward_amount;
        config.bump = ctx.bumps.config;

        Ok(())
    }

    pub fn actualizar_cashback_config(
        ctx: Context<ActualizarCashbackConfig>,
        reward_amount: u64,
    ) -> Result<()> {
        require!(reward_amount > 0, ErroresGaleria::MontoInvalido);

        ctx.accounts.config.reward_amount = reward_amount;
        Ok(())
    }

    // Compra atómica: SOL al creador y FWC al comprador.
    // El precio y la recompensa se obtienen de cuentas on-chain.
    pub fn registrar_cashback(
        ctx: Context<RegistrarCashback>,
        purchase_id: [u8; 32],
    ) -> Result<()> {
        let payment_amount = ctx.accounts.wallpaper.precio_lamports;
        let reward_amount = ctx.accounts.config.reward_amount;

        require!(payment_amount > 0, ErroresGaleria::MontoInvalido);
        require!(reward_amount > 0, ErroresGaleria::MontoInvalido);
        require!(
            ctx.accounts.wallpaper.owner != ctx.accounts.buyer.key(),
            ErroresGaleria::NoAutorizado
        );

        require!(
            ctx.accounts.mint.decimals == FWC_DECIMALES,
            ErroresGaleria::DecimalesInvalidos
        );
        require_keys_eq!(
            ctx.accounts.token_program.key(),
            TOKEN_2022_PROGRAM_ID,
            ErroresGaleria::ProgramaTokenInvalido
        );
        require!(
            ctx.accounts.reserve.amount >= reward_amount,
            ErroresGaleria::ReservaInsuficiente
        );

        // Registrar la compra.
        let record = &mut ctx.accounts.cashback_record;
        record.purchase_id = purchase_id;
        record.buyer = ctx.accounts.buyer.key();
        record.creator = ctx.accounts.creator.key();
        record.payment_amount = payment_amount;
        record.reward_amount = reward_amount;
        record.admin = FWC_ADMIN;
        record.bump = ctx.bumps.cashback_record;

        // 1. SOL directamente del comprador al creador.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            ),
            payment_amount,
        )?;

        // 2. FWC desde la reserva mediante la PDA PermanentDelegate.
        let bump = [ctx.bumps.fwc_delegate];
        let signer_seeds: &[&[u8]] = &[SEED_FWC_DELEGATE, &bump];
        let signer = &[signer_seeds];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.reserve.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.fwc_delegate.to_account_info(),
        };

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            reward_amount,
            ctx.accounts.mint.decimals,
        )?;

        // 3. Incrementar descargas.
        ctx.accounts.wallpaper.descargas = ctx.accounts.wallpaper.descargas
            .checked_add(1)
            .ok_or(ErroresGaleria::ContadorDesbordado)?;

        Ok(())
    }

    pub fn revertir_cashback(
        ctx: Context<RevertirCashback>,
        _purchase_id: [u8; 32],
    ) -> Result<()> {
        let reward_amount = ctx.accounts.cashback_record.reward_amount;

        require!(reward_amount > 0, ErroresGaleria::MontoInvalido);
        require!(
            ctx.accounts.mint.decimals == FWC_DECIMALES,
            ErroresGaleria::DecimalesInvalidos
        );

        let bump = [ctx.bumps.fwc_delegate];
        let signer_seeds: &[&[u8]] = &[SEED_FWC_DELEGATE, &bump];
        let signer = &[signer_seeds];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.reserve.to_account_info(),
            authority: ctx.accounts.fwc_delegate.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );

        token_interface::transfer_checked(
            cpi_context,
            reward_amount,
            ctx.accounts.mint.decimals,
        )?;

        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Contextos de cuentas
// -----------------------------------------------------------------------------

#[derive(Accounts)]
pub struct CrearGaleria<'info> {
    #[account(
        init,
        payer = owner,
        space = Galeria::SPACE,
        seeds = [SEED_GALERIA, owner.key().as_ref()],
        bump
    )]
    pub galeria: Account<'info, Galeria>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PublicarWallpaper<'info> {
    #[account(
        mut,
        seeds = [SEED_GALERIA, owner.key().as_ref()],
        bump = galeria.bump,
        has_one = owner @ ErroresGaleria::NoAutorizado
    )]
    pub galeria: Account<'info, Galeria>,

    #[account(
        init,
        payer = owner,
        space = Wallpaper::SPACE,
        seeds = [
            SEED_WALLPAPER,
            galeria.key().as_ref(),
            galeria.total_wallpapers.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub wallpaper: Account<'info, Wallpaper>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActualizarPrecio<'info> {
    #[account(
        seeds = [SEED_GALERIA, owner.key().as_ref()],
        bump = galeria.bump,
        has_one = owner @ ErroresGaleria::NoAutorizado
    )]
    pub galeria: Account<'info, Galeria>,

    #[account(
        mut,
        seeds = [
            SEED_WALLPAPER,
            galeria.key().as_ref(),
            wallpaper.id.to_le_bytes().as_ref()
        ],
        bump = wallpaper.bump,
        has_one = owner @ ErroresGaleria::NoAutorizado,
        has_one = galeria @ ErroresGaleria::GaleriaInvalida
    )]
    pub wallpaper: Account<'info, Wallpaper>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct EliminarWallpaper<'info> {
    #[account(
        seeds = [SEED_GALERIA, owner.key().as_ref()],
        bump = galeria.bump,
        has_one = owner @ ErroresGaleria::NoAutorizado
    )]
    pub galeria: Account<'info, Galeria>,

    #[account(
        mut,
        close = owner,
        seeds = [
            SEED_WALLPAPER,
            galeria.key().as_ref(),
            wallpaper.id.to_le_bytes().as_ref()
        ],
        bump = wallpaper.bump,
        has_one = owner @ ErroresGaleria::NoAutorizado,
        has_one = galeria @ ErroresGaleria::GaleriaInvalida
    )]
    pub wallpaper: Account<'info, Wallpaper>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InicializarCashbackConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = CashbackConfig::SPACE,
        seeds = [SEED_CASHBACK_CONFIG],
        bump
    )]
    pub config: Account<'info, CashbackConfig>,

    #[account(mut, address = FWC_ADMIN)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActualizarCashbackConfig<'info> {
    #[account(
        mut,
        seeds = [SEED_CASHBACK_CONFIG],
        bump = config.bump,
        has_one = admin @ ErroresGaleria::NoAutorizado
    )]
    pub config: Account<'info, CashbackConfig>,

    #[account(address = FWC_ADMIN)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(purchase_id: [u8; 32])]
pub struct RegistrarCashback<'info> {
    #[account(
        init,
        payer = buyer,
        space = CashbackRecord::SPACE,
        seeds = [SEED_CASHBACK, purchase_id.as_ref()],
        bump
    )]
    pub cashback_record: Account<'info, CashbackRecord>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            SEED_WALLPAPER,
            wallpaper.galeria.as_ref(),
            wallpaper.id.to_le_bytes().as_ref()
        ],
        bump = wallpaper.bump
    )]
    pub wallpaper: Account<'info, Wallpaper>,

    #[account(mut, address = wallpaper.owner)]
    pub creator: SystemAccount<'info>,

    #[account(
        seeds = [SEED_CASHBACK_CONFIG],
        bump = config.bump,
        constraint = config.admin == FWC_ADMIN @ ErroresGaleria::NoAutorizado
    )]
    pub config: Account<'info, CashbackConfig>,

    /// CHECK: PDA configurada como PermanentDelegate del mint FWC.
    #[account(
        seeds = [SEED_FWC_DELEGATE],
        bump
    )]
    pub fwc_delegate: UncheckedAccount<'info>,

    #[account(address = FWC_MINT @ ErroresGaleria::MintInvalido)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = reserve.mint == mint.key() @ ErroresGaleria::MintInvalido,
        constraint = reserve.owner == FWC_ADMIN @ ErroresGaleria::NoAutorizado
    )]
    pub reserve: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(purchase_id: [u8; 32])]
pub struct RevertirCashback<'info> {
    #[account(
        mut,
        address = FWC_ADMIN @ ErroresGaleria::NoAutorizado
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        close = admin,
        seeds = [SEED_CASHBACK, purchase_id.as_ref()],
        bump = cashback_record.bump,
        constraint = cashback_record.admin == admin.key() @ ErroresGaleria::NoAutorizado
    )]
    pub cashback_record: Account<'info, CashbackRecord>,

    /// CHECK: Se valida contra el comprador guardado en el registro.
    #[account(address = cashback_record.buyer)]
    pub buyer: UncheckedAccount<'info>,

    #[account(address = FWC_MINT @ ErroresGaleria::MintInvalido)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = reserve.mint == mint.key() @ ErroresGaleria::MintInvalido,
        constraint = reserve.owner == admin.key() @ ErroresGaleria::NoAutorizado
    )]
    pub reserve: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        seeds = [SEED_FWC_DELEGATE],
        bump
    )]
    /// CHECK: PDA configurada como PermanentDelegate del mint.
    pub fwc_delegate: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// -----------------------------------------------------------------------------
// Cuentas
// -----------------------------------------------------------------------------

#[account]
pub struct Galeria {
    pub owner: Pubkey,
    pub nombre_galeria: String,
    pub total_wallpapers: u64,
    pub bump: u8,
}

impl Galeria {
    pub const SPACE: usize = 8 + 32 + (4 + MAX_NOMBRE_GALERIA) + 8 + 1;
}

#[account]
pub struct Wallpaper {
    pub owner: Pubkey,
    pub galeria: Pubkey,
    pub id: u64,
    pub titulo: String,
    pub juego: String,
    pub url_imagen: String,
    pub precio_lamports: u64,
    pub descargas: u64,
    pub bump: u8,
}

impl Wallpaper {
    pub const SPACE: usize = 8
        + 32 + 32 + 8
        + (4 + MAX_TITULO)
        + (4 + MAX_JUEGO)
        + (4 + MAX_URL_IMAGEN)
        + 8 + 8 + 1;
}

#[account]
pub struct CashbackConfig {
    pub admin: Pubkey,
    pub reward_amount: u64,
    pub bump: u8,
}

impl CashbackConfig {
    pub const SPACE: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct CashbackRecord {
    pub purchase_id: [u8; 32],
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub payment_amount: u64,
    pub reward_amount: u64,
    pub admin: Pubkey,
    pub bump: u8,
}

impl CashbackRecord {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 32 + 1;
}

// -----------------------------------------------------------------------------
// Errores
// -----------------------------------------------------------------------------

#[error_code]
pub enum ErroresGaleria {
    #[msg("El nombre de la galería excede el máximo de 30 caracteres.")]
    NombreGaleriaMuyLargo,
    #[msg("El título excede el máximo de 30 caracteres.")]
    TituloMuyLargo,
    #[msg("El nombre del juego excede el máximo de 20 caracteres.")]
    JuegoMuyLargo,
    #[msg("La URL de la imagen excede el máximo de 80 caracteres.")]
    UrlMuyLarga,
    #[msg("Los campos de texto no pueden estar vacíos.")]
    CampoVacio,
    #[msg("Permiso denegado: solo el propietario puede realizar esta acción.")]
    NoAutorizado,
    #[msg("El wallpaper no pertenece a la galería indicada.")]
    GaleriaInvalida,
    #[msg("El contador de wallpapers se desbordó.")]
    ContadorDesbordado,
    #[msg("El monto debe ser mayor que cero.")]
    MontoInvalido,
    #[msg("Los decimales del mint no coinciden con los esperados.")]
    DecimalesInvalidos,
    #[msg("El programa de tokens debe ser Token-2022.")]
    ProgramaTokenInvalido,
    #[msg("La reserva no tiene suficientes FWC.")]
    ReservaInsuficiente,
    #[msg("El mint no corresponde al token FWC autorizado.")]
    MintInvalido,
}
