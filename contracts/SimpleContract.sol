// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
import "hardhat/console.sol";
import "./helpers/AaveBase.sol";
import "./interfaces/ILendingPoolAddressesProvider.sol";
import "./interfaces/IPriceOracleGetter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleContract is AaveBase {
    constructor(ILendingPoolAddressesProvider _lendingPoolAddressProvider, IPriceOracleGetter _aaveOracleAddress) AaveBase(_lendingPoolAddressProvider, _aaveOracleAddress) {}

   function sayHello() public {
       console.log('Hello World!');
       console.log("sender", msg.sender);
   }

    function approveAndSayHello(address asset, uint256 amount, address limitOrderProtocol) public {
        IERC20(asset).approve(address(limitOrderProtocol), amount-10);
        IERC20(asset).approve(address(LENDING_POOL), 10);
        LENDING_POOL.deposit(asset, 10, msg.sender, 0);
        console.log('Hello World from approveAndSayHello!');
        console.log("sender", msg.sender);
    }

    function deposit(address asset, uint256 amount) external {
        IERC20(asset).approve(address(LENDING_POOL), amount);
        LENDING_POOL.deposit(asset, amount, msg.sender, 0);
    }
}
