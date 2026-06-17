use soroban_sdk::{symbol_short, Address, Env, IntoVal};

/// Deposit `amount` into a Stellar AMM pool.
/// Funds must already be in this contract before calling.
pub fn amm_deposit(env: &Env, pool: &Address, token: &Address, amount: i128, to: &Address) -> i128 {
    let _shares: i128 = env.invoke_contract(
        pool,
        &symbol_short!("deposit"),
        soroban_sdk::vec![
            env,
            token.into_val(env),
            amount.into_val(env),
            to.into_val(env),
        ],
    );
    amount
}

/// Withdraw `amount` from a Stellar AMM pool back to `to`.
/// Returns the recovered token amount.
pub fn amm_withdraw(env: &Env, pool: &Address, token: &Address, amount: i128, to: &Address) -> i128 {
    let recovered: i128 = env.invoke_contract(
        pool,
        &symbol_short!("withdraw"),
        soroban_sdk::vec![
            env,
            token.into_val(env),
            amount.into_val(env),
            to.into_val(env),
        ],
    );
    recovered
}

/// Query the AMM pool for the current value of `account`'s position.
/// Calls `get_pos` on the pool contract, returning the token-equivalent value.
pub fn get_position_value(env: &Env, pool: &Address, token: &Address, account: &Address) -> i128 {
    env.invoke_contract(
        pool,
        &symbol_short!("get_pos"),
        soroban_sdk::vec![
            env,
            token.into_val(env),
            account.into_val(env),
        ],
    )
}
