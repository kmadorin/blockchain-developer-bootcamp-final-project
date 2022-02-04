// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { ILendingPoolAddressesProvider } from "../interfaces/ILendingPoolAddressesProvider.sol";
import { ILendingPool } from "../interfaces/ILendingPool.sol";
import { IPriceOracleGetter } from "../interfaces/IPriceOracleGetter.sol";

abstract contract AaveBase {
  ILendingPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
  ILendingPool public immutable LENDING_POOL;
  IPriceOracleGetter public immutable AAVE_ORACLE;

  constructor(ILendingPoolAddressesProvider provider, IPriceOracleGetter priceOracleAddress) {
    ADDRESSES_PROVIDER = provider;
    LENDING_POOL = ILendingPool(provider.getLendingPool());
    AAVE_ORACLE = IPriceOracleGetter(priceOracleAddress);
  }
}
