use anchor_lang::prelude::*;

declare_id!("Ea36TN2o2oBB1wm1UZ4AkNzuqjrYaDLGprmKPziqBJ1Y");  // Replace with your deployed program ID

#[program]
pub mod solana_rogue {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let highscore_account = &mut ctx.accounts.highscore;
        highscore_account.player = ctx.accounts.user.key();
        highscore_account.score = 0;
        Ok(())
    }

    pub fn update_score(ctx: Context<UpdateScore>, new_score: u32) -> Result<()> {
        let highscore_account = &mut ctx.accounts.highscore;
        if new_score > highscore_account.score {
            highscore_account.score = new_score;
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, seeds = [b"highscore", user.key().as_ref()], bump, payer = user, space = 8 + 32 + 4)]
    pub highscore: Account<'info, HighScore>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateScore<'info> {
    #[account(mut, seeds = [b"highscore", player.key().as_ref()], bump)]
    pub highscore: Account<'info, HighScore>,
    pub player: Signer<'info>,
}

#[account]
pub struct HighScore {
    pub player: Pubkey,
    pub score: u32,
}
