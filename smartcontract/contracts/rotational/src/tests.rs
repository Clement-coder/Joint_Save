#![cfg(test)]

use super::{RotationalPool, RotationalPoolClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env, Vec,
};

#[test]
fn test_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    // Setup contract and clients
    let contract_id = env.register_contract(None, RotationalPool);
    let client = RotationalPoolClient::new(&env, &contract_id);

    // Setup token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_client = token::StellarAssetClient::new(&env, &token_address);
    let token_interface_client = token::Client::new(&env, &token_address);

    // Setup actors
    let treasury = Address::generate(&env);
    let relayer = Address::generate(&env);
    let member_a = Address::generate(&env);
    let member_b = Address::generate(&env);
    let member_c = Address::generate(&env);

    let mut members = Vec::new(&env);
    members.push_back(member_a.clone());
    members.push_back(member_b.clone());
    members.push_back(member_c.clone());

    let deposit_amount = 100i128;
    let round_duration = 100u64;
    let treasury_fee_bps = 500u32; // 5%
    let relayer_fee_bps = 200u32;  // 2%

    // Initialize pool
    client.initialize(
        &token_address,
        &members,
        &deposit_amount,
        &round_duration,
        &treasury_fee_bps,
        &relayer_fee_bps,
        &treasury,
    );

    // Verify initial state
    assert!(client.is_active());
    assert_eq!(client.current_round(), 0);
    assert_eq!(client.members().len(), 3);
    assert_eq!(client.next_payout_time(), env.ledger().timestamp() + round_duration);

    // Mint tokens to members
    token_client.mint(&member_a, &deposit_amount);
    token_client.mint(&member_b, &deposit_amount);
    token_client.mint(&member_c, &deposit_amount);

    // Deposit for each member
    client.deposit(&member_a);
    client.deposit(&member_b);
    client.deposit(&member_c);

    // Check deposits registered
    assert!(client.has_deposited(&member_a));
    assert!(client.has_deposited(&member_b));
    assert!(client.has_deposited(&member_c));

    // Advance time to allow payout
    let next_payout = client.next_payout_time();
    env.ledger().set_timestamp(next_payout);

    // Trigger payout
    client.trigger_payout(&relayer);

    // Total collected = 300
    // Treasury fee = 300 * 5% = 15
    // Relayer fee = 300 * 2% = 6
    // Payout amount = 300 - 15 - 6 = 279
    // Beneficiary of round 0 is member_a
    assert_eq!(token_interface_client.balance(&member_a), 279);
    assert_eq!(token_interface_client.balance(&treasury), 15);
    assert_eq!(token_interface_client.balance(&relayer), 6);

    // Round should have advanced
    assert_eq!(client.current_round(), 1);
    assert_eq!(client.next_payout_time(), next_payout + round_duration);

    // Deposited flags reset
    assert!(!client.has_deposited(&member_a));
}
