use soroban_sdk::{symbol_short, Address, Env, IntoVal};

/// Single-asset deposit into Soroswap via the router's `add_liq` entry point.
/// `amount_b = 0` signals a one-sided deposit.
/// Funds must already be in this contract before calling.
pub fn add_liquidity(
    env: &Env,
    router: &Address,
    token_a: &Address,
    token_b: &Address,
    amount_a: i128,
    amount_b: i128,
    to: &Address,
) -> i128 {
    let _lp: i128 = env.invoke_contract(
        router,
        &symbol_short!("add_liq"),
        soroban_sdk::vec![
            env,
            token_a.into_val(env),
            token_b.into_val(env),
            amount_a.into_val(env),
            amount_b.into_val(env),
            to.into_val(env),
        ],
    );
    amount_a
}

/// Withdraw `lp_amount` from the Soroswap pair back to `to`.
/// Returns the recovered token_a amount.
pub fn remove_liquidity(
    env: &Env,
    router: &Address,
    token_a: &Address,
    token_b: &Address,
    lp_amount: i128,
    to: &Address,
) -> i128 {
    let recovered: i128 = env.invoke_contract(
        router,
        &symbol_short!("rem_liq"),
        soroban_sdk::vec![
            env,
            token_a.into_val(env),
            token_b.into_val(env),
            lp_amount.into_val(env),
            to.into_val(env),
        ],
    );
    recovered
}

/// Query the Soroswap router for the current value of this contract's position.
/// Calls `get_pos` on the router, which returns the token_a-equivalent value.
pub fn get_position_value(
    env: &Env,
    router: &Address,
    token_a: &Address,
    token_b: &Address,
    account: &Address,
) -> i128 {
    env.invoke_contract(
        router,
        &symbol_short!("get_pos"),
        soroban_sdk::vec![
            env,
            token_a.into_val(env),
            token_b.into_val(env),
            account.into_val(env),
        ],
    )
}
