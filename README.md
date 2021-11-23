# A set of tools based on 1inch limit order protocol (Consensys developer bootcamp 2021 final project)

This dapp will allow users to:
* create limit orders to liquidate unhealthy Aave positions
* create limit orders to protect their Aave positions from liquidations
* create, manage and close leveraged positions with stop-loss/take-profit using 1inch limit orders.

## Liquidation workflow
0. Login with Metamask
1. Get all aave positions using The Graph
2. Sort these positions by a health factor
3. Choose a position which health factor is below 1 or close to 1
4. Create a limit order in which:
   * Taker asset is a debt asset
   * Maker asset is a collateral asset
   * Taker amount - 50% of debt amount in taker asset  
   * Maker amount - 50% of collateral amount in maker asset
5. Send a limit order to 1inch
6. Get a confirmation of transaction or error
7. See the list of all limit orders sent from the app
8. Close one of the limit orders if needed
9. See transaction confirmation

## Liquidation protection workflow
0. Login with Metamask
1. Get user's info
   * user's account data on Aave + health factor. If no data - show that this user hasn't opened positions on Aaave 
   * Limit orders created by a user to protect his aave position
2. Choose a target health factor
3. Create a limit order to protect a position. 
   * Taker asset is a debt asset
   * Maker asset is a collateral asset
   * Taker amount - debt amount in taker asset
   * Maker amount - collateral amount in maker asset that is equal to debt amount
4. Send this limit order to 1inch
5. Get confirmation or error of sending an order
6. Update a list of orders
7. If order was filled, update list of orders and add filled order to  

## Leveraged positions/margin trading workflow
1. Connect with Metamask
2. Show a list of created positions by a user
3. Create new position
***
TODO
***
